import { NextResponse } from 'next/server';
import { db } from '@/db';
import { keywords, interests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { cleanString, parsePositiveInteger, readJsonRecord } from '@/lib/api-validation';
import { rateLimitByRequest } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = rateLimitByRequest(request, 'keywords:post', 60, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const body = await readJsonRecord(request);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const interestId = parsePositiveInteger(body.interestId);
    const word = cleanString(body.word, 100);
    if (!interestId || !word) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    
    // Verify interest (channel) ownership
    const channel = await db.query.interests.findFirst({
      where: and(eq(interests.id, interestId), eq(interests.userId, session.user.id))
    });
    if (!channel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const duplicate = await db.query.keywords.findFirst({
      where: and(eq(keywords.interestId, interestId), eq(keywords.word, word)),
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Keyword already exists' }, { status: 409 });
    }

    const [result] = await db.insert(keywords).values({ 
      interestId, 
      word
    }).returning();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to add keyword:', error);
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = rateLimitByRequest(request, 'keywords:delete', 60, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const { searchParams } = new URL(request.url);
    const id = parsePositiveInteger(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
    
    // Verify that the keyword's parent interest (channel) belongs to the user
    const kw = await db.query.keywords.findFirst({
      where: eq(keywords.id, id),
      with: {
        interest: true
      }
    });

    if (!kw) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    
    if (kw.interest.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    await db.delete(keywords).where(eq(keywords.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete keyword:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
