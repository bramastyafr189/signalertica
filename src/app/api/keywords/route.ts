import { NextResponse } from 'next/server';
import { db } from '@/db';
import { keywords, interests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { interestId, word } = await request.json();
    if (!interestId || !word) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    
    // Verify interest (channel) ownership
    const channel = await db.query.interests.findFirst({
      where: and(eq(interests.id, parseInt(interestId)), eq(interests.userId, session.user.id))
    });
    if (!channel) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [result] = await db.insert(keywords).values({ 
      interestId: parseInt(interestId), 
      word: word.trim() 
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    
    // Verify that the keyword's parent interest (channel) belongs to the user
    const kw = await db.query.keywords.findFirst({
      where: eq(keywords.id, parseInt(id)),
      with: {
        interest: true
      }
    });

    if (!kw) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    
    if (kw.interest.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    await db.delete(keywords).where(eq(keywords.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete keyword:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
