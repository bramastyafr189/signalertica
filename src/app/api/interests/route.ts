import { NextResponse } from 'next/server';
import { db } from '@/db';
import { interests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allInterests = await db.query.interests.findMany({
      where: eq(interests.userId, session.user.id),
      with: {
        keywords: true,
      },
    });
    return NextResponse.json(allInterests);
  } catch (error) {
    console.error('Failed to fetch interests:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, language, country } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    
    const [result] = await db.insert(interests).values({ 
      userId: session.user.id,
      name,
      language: language || null,
      country: country || null
    }).returning();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to create interest:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const { name, language, country, refreshInterval, notificationsEnabled, lastScanAt } = await request.json();
    
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    
    // Verify ownership
    const existing = await db.query.interests.findFirst({
      where: and(eq(interests.id, parseInt(id)), eq(interests.userId, session.user.id))
    });
    if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
    await db.update(interests)
      .set({ 
        name: name !== undefined ? name : undefined,
        language: language !== undefined ? language : undefined,
        country: country !== undefined ? country : undefined,
        refreshInterval: refreshInterval !== undefined ? refreshInterval : undefined,
        notificationsEnabled: notificationsEnabled !== undefined ? notificationsEnabled : undefined,
        lastScanAt: lastScanAt !== undefined ? (lastScanAt ? new Date(lastScanAt) : null) : undefined,
      })
      .where(eq(interests.id, parseInt(id)));
      
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update interest:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
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
    
    // Verify ownership
    const existing = await db.query.interests.findFirst({
      where: and(eq(interests.id, parseInt(id)), eq(interests.userId, session.user.id))
    });
    if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
    await db.delete(interests).where(eq(interests.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete interest:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
