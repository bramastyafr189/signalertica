import { db } from '@/db';
import { intelligenceLogs, capturedArticles } from '@/db/schema';
import { desc, eq, gt, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { cleanString, isRecord, optionalCleanString, parseOptionalDate, readJsonRecord } from '@/lib/api-validation';
import { rateLimitByRequest } from '@/lib/rate-limit';

type CapturedArticleInput = {
  title: string;
  description: string | null;
  image: string | null;
  url: string;
  source: string;
  publishedAt: string;
};

function parseArticles(value: unknown): CapturedArticleInput[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const articles = value.slice(0, 100).map((article) => {
    if (!isRecord(article)) return null;

    const title = cleanString(article.title, 300);
    const url = cleanString(article.url, 2048);
    const source = cleanString(article.source, 160);
    const publishedAt = cleanString(article.publishedAt, 80);

    if (!title || !url || !source || !publishedAt) return null;

    return {
      title,
      description: optionalCleanString(article.description, 1000),
      image: optionalCleanString(article.image, 2048),
      url,
      source,
      publishedAt,
    };
  });

  if (articles.some((article) => article === null)) return null;
  return articles as CapturedArticleInput[];
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = rateLimitByRequest(req, 'logs:get', 120, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    // Only return logs from the last 24 hours for the current user
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const logs = await db.query.intelligenceLogs.findMany({
      where: and(
        eq(intelligenceLogs.userId, session.user.id),
        gt(intelligenceLogs.timestamp, twentyFourHoursAgo)
      ),
      with: {
        articles: true,
      },
      orderBy: [desc(intelligenceLogs.timestamp)],
      limit: 100,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json({ error: 'Failed to fetch intelligence logs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = rateLimitByRequest(req, 'logs:post', 60, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const body = await readJsonRecord(req);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const title = cleanString(body.title, 120);
    const logBody = cleanString(body.body, 500);
    const channel = cleanString(body.channel, 160);
    const timestamp = parseOptionalDate(body.timestamp);
    const articles = parseArticles(body.articles);
    const suppliedId = cleanString(body.id, 80);
    const logId = suppliedId || crypto.randomUUID();

    if (!title || !logBody || !channel || !timestamp || !articles) {
      return NextResponse.json({ error: 'Invalid intelligence log payload' }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx.insert(intelligenceLogs).values({
        id: logId,
        userId: session.user.id,
        title,
        body: logBody,
        channel,
        timestamp,
      });

      if (articles.length > 0) {
        await tx.insert(capturedArticles).values(
          articles.map((art) => ({
            logId: logId,
            title: art.title,
            description: art.description,
            image: art.image,
            url: art.url,
            source: art.source,
            publishedAt: art.publishedAt,
          }))
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save log:', error);
    return NextResponse.json({ error: 'Failed to save intelligence log' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = rateLimitByRequest(req, 'logs:delete', 20, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    await db.delete(intelligenceLogs).where(eq(intelligenceLogs.userId, session.user.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    return NextResponse.json({ error: 'Failed to clear intelligence logs' }, { status: 500 });
  }
}
