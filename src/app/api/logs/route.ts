import { db } from '@/db';
import { intelligenceLogs, capturedArticles } from '@/db/schema';
import { desc, eq, gt, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const body = await req.json();
    const { id, title, body: logBody, channel, timestamp, articles } = body;
    const logId = id || Math.random().toString(36).substr(2, 9);

    await db.transaction(async (tx) => {
      await tx.insert(intelligenceLogs).values({
        id: logId,
        userId: session.user.id,
        title,
        body: logBody,
        channel,
        timestamp: new Date(timestamp),
      });

      if (articles && articles.length > 0) {
        await tx.insert(capturedArticles).values(
          articles.map((art: any) => ({
            logId: logId,
            title: art.title,
            description: art.description,
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

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.delete(intelligenceLogs).where(eq(intelligenceLogs.userId, session.user.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    return NextResponse.json({ error: 'Failed to clear intelligence logs' }, { status: 500 });
  }
}
