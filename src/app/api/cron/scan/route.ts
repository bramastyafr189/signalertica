import { db } from '@/db';
import { interests, intelligenceLogs, capturedArticles, pushSubscriptions, systemSettings } from '@/db/schema';
import { getNewsOnServer } from '@/lib/news-fetcher';
import { eq, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { rateLimitByRequest } from '@/lib/rate-limit';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:bramastya@example.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

function getWebPushStatusCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : null;
  }
  return null;
}

export async function GET(req: Request) {
  // Security check for Vercel Cron
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === 'production' && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = rateLimitByRequest(req, 'cron:scan', 12, 60_000, authHeader || undefined);
  if (rateLimited) return rateLimited;

  console.log('[CRON] Starting global intelligence scan...');
  
  try {
    // 0. Self-Cleaning: Delete logs older than 24 hours
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(intelligenceLogs).where(lte(intelligenceLogs.timestamp, cutoffDate));
    console.log('[CRON] Database cleanup complete: Removed signals older than 24h.');

    // 1. Check Global Kill Switch
    const globalSettings = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.id, 'global')
    });

    if (globalSettings && !globalSettings.isSyncEnabled) {
      console.log('[CRON] Scan aborted: Intelligence Engine is disabled globally.');
      return NextResponse.json({ 
        success: false, 
        message: 'Intelligence Engine is disabled globally.' 
      });
    }

    // 2. Fetch all channels
    const channels = await db.query.interests.findMany({
      with: {
        keywords: true
      }
    });

    let totalNewArticles = 0;
    const now = new Date();

    for (const channel of channels) {
      // 1. Skip if no keywords, or interval is set to Manual (0) or null
      const interval = channel.refreshInterval || 0;
      if (channel.keywords.length === 0 || interval <= 0) continue;

      const lastScanAt = channel.lastScanAt ? new Date(channel.lastScanAt) : new Date(0);
      const diffMinutes = (now.getTime() - lastScanAt.getTime()) / (1000 * 60);

      // 2. Only scan if the time elapsed is >= the user-defined interval
      if (diffMinutes < interval) {
        console.log(`[CRON] Skipping "${channel.name}" for user ${channel.userId} (Next scan in ${Math.round(interval - diffMinutes)} mins)`);
        continue;
      }

      console.log(`[CRON] Scanning "${channel.name}" pipeline for user ${channel.userId}...`);
      const keywords = channel.keywords.map(k => k.word);
      const articles = await getNewsOnServer(keywords.join(' OR '), channel.language || 'any', channel.country || 'any');
      
      const newArticles = articles.filter(a => new Date(a.publishedAt) > lastScanAt);

      if (newArticles.length > 0) {
        totalNewArticles += newArticles.length;
        const logId = crypto.randomUUID();

        // a. Save to Intelligence Logs
        await db.transaction(async (tx) => {
          await tx.insert(intelligenceLogs).values({
            id: logId,
            userId: channel.userId,
            title: `+${newArticles.length}`,
            body: `Background sync complete for "${channel.name}" pipeline.`,
            channel: channel.name,
            timestamp: now,
          });

          await tx.insert(capturedArticles).values(
            newArticles.map(art => ({
              logId: logId,
              title: art.title,
              description: art.description,
              image: art.image,
              url: art.url,
              source: art.source,
              publishedAt: art.publishedAt,
            }))
          );

          // b. Update lastScanAt for the channel
          await tx.update(interests)
            .set({ lastScanAt: now })
            .where(eq(interests.id, channel.id));
        });

        // c. Trigger Web Push for this channel if notifications enabled
        if (channel.notificationsEnabled && vapidPublicKey && vapidPrivateKey) {
          // Send ONLY to subscriptions belonging to the channel's owner
          const subscriptions = await db.query.pushSubscriptions.findMany({
            where: eq(pushSubscriptions.userId, channel.userId)
          });
          
          // Construct a "Smart" notification payload
          const count = newArticles.length;
          const notificationTitle = `${channel.name}: ${count} ${count === 1 ? 'Target Acquired' : 'Targets Detected'}`;
          let notificationBody = "";

          if (count === 1) {
            // Rule for single article: Show the direct title
            notificationBody = newArticles[0].title;
          } else {
            // Rule for multiple articles: Show a summarized list
            const bulletPoints = newArticles
              .slice(0, 3)
              .map(a => `• ${a.title.slice(0, 60)}${a.title.length > 60 ? '...' : ''}`)
              .join('\n');
            
            notificationBody = `${bulletPoints}${count > 3 ? `\n...and ${count - 3} more signals.` : ''}`;
          }

          const payload = JSON.stringify({
            title: notificationTitle,
            body: notificationBody,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: `intel-${channel.id}`, // Groups notifications by channel on Android
            data: {
              url: `/?tab=account&logId=${logId}` // Directs to Logs and opens specific log modal
            }
          });

          for (const sub of subscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                  }
                },
                payload
              );
            } catch (error: unknown) {
              const statusCode = getWebPushStatusCode(error);
              if (statusCode === 410 || statusCode === 404) {
                // Subscription has expired or is no longer valid
                await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
              }
              console.error(`Failed to send push to ${sub.endpoint}:`, error);
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      scannedChannels: channels.length,
      newArticlesFound: totalNewArticles 
    });
  } catch (error) {
    console.error('[CRON] Scan failed:', error);
    return NextResponse.json({ error: 'Background scan failed' }, { status: 500 });
  }
}
