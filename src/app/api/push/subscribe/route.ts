import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { cleanString, isRecord, readJsonRecord } from '@/lib/api-validation';
import { rateLimitByRequest } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = rateLimitByRequest(req, 'push:subscribe', 20, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const subscription = await readJsonRecord(req);
    
    if (!subscription || !isRecord(subscription.keys)) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const endpoint = cleanString(subscription.endpoint, 2048);
    const p256dh = cleanString(subscription.keys.p256dh, 512);
    const auth = cleanString(subscription.keys.auth, 512);

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // Check if subscription already exists
    const existing = await db.query.pushSubscriptions.findFirst({
      where: eq(pushSubscriptions.endpoint, endpoint)
    });

    if (existing) {
      // If the subscription is registered to a different user, update the owner
      if (existing.userId !== session.user.id) {
        await db.update(pushSubscriptions)
          .set({ userId: session.user.id })
          .where(eq(pushSubscriptions.id, existing.id));
      }
      return NextResponse.json({ success: true, message: 'Already subscribed' });
    }

    // Save new subscription for this user
    await db.insert(pushSubscriptions).values({
      userId: session.user.id,
      endpoint,
      p256dh,
      auth,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
