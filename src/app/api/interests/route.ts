import { NextResponse } from 'next/server';
import { db } from '@/db';
import { interests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  cleanString,
  optionalCleanString,
  parseNonNegativeInteger,
  parseOptionalBoolean,
  parseOptionalDate,
  parsePositiveInteger,
  readJsonRecord,
} from '@/lib/api-validation';
import { rateLimitByRequest } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimited = rateLimitByRequest(request, 'interests:get', 120, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

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

    const rateLimited = rateLimitByRequest(request, 'interests:post', 30, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const body = await readJsonRecord(request);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const name = cleanString(body.name);
    const language = optionalCleanString(body.language, 12);
    const country = optionalCleanString(body.country, 12);
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const duplicate = await db.query.interests.findFirst({
      where: and(eq(interests.userId, session.user.id), eq(interests.name, name)),
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Channel name already exists' }, { status: 409 });
    }
    
    const [result] = await db.insert(interests).values({ 
      userId: session.user.id,
      name,
      language,
      country
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

    const rateLimited = rateLimitByRequest(request, 'interests:patch', 60, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const { searchParams } = new URL(request.url);
    const id = parsePositiveInteger(searchParams.get('id'));
    const body = await readJsonRecord(request);
    
    if (!id) return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const nextName = body.name !== undefined ? cleanString(body.name) : undefined;
    const nextLanguage = body.language !== undefined ? optionalCleanString(body.language, 12) : undefined;
    const nextCountry = body.country !== undefined ? optionalCleanString(body.country, 12) : undefined;
    const nextRefreshInterval = body.refreshInterval !== undefined ? parseNonNegativeInteger(body.refreshInterval) : undefined;
    const nextNotificationsEnabled = parseOptionalBoolean(body.notificationsEnabled);
    const nextLastScanAt = parseOptionalDate(body.lastScanAt);

    if (body.name !== undefined && !nextName) return NextResponse.json({ error: 'Name is invalid' }, { status: 400 });
    if (body.refreshInterval !== undefined && nextRefreshInterval === null) return NextResponse.json({ error: 'Refresh interval is invalid' }, { status: 400 });
    if (body.notificationsEnabled !== undefined && nextNotificationsEnabled === undefined) return NextResponse.json({ error: 'notificationsEnabled must be boolean' }, { status: 400 });
    if (body.lastScanAt !== undefined && nextLastScanAt === undefined) return NextResponse.json({ error: 'lastScanAt is invalid' }, { status: 400 });
    
    // Verify ownership
    const existing = await db.query.interests.findFirst({
      where: and(eq(interests.id, id), eq(interests.userId, session.user.id))
    });
    if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (nextName && nextName !== existing.name) {
      const duplicate = await db.query.interests.findFirst({
        where: and(eq(interests.userId, session.user.id), eq(interests.name, nextName)),
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Channel name already exists' }, { status: 409 });
      }
    }

    const updateValues: {
      name?: string;
      language?: string | null;
      country?: string | null;
      refreshInterval?: number;
      notificationsEnabled?: boolean;
      lastScanAt?: Date | null;
    } = {};

    if (nextName !== undefined && nextName !== null) updateValues.name = nextName;
    if (nextLanguage !== undefined) updateValues.language = nextLanguage;
    if (nextCountry !== undefined) updateValues.country = nextCountry;
    if (nextRefreshInterval !== undefined && nextRefreshInterval !== null) updateValues.refreshInterval = nextRefreshInterval;
    if (nextNotificationsEnabled !== undefined) updateValues.notificationsEnabled = nextNotificationsEnabled;
    if (nextLastScanAt !== undefined) updateValues.lastScanAt = nextLastScanAt;

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    
    await db.update(interests)
      .set(updateValues)
      .where(eq(interests.id, id));
      
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

    const rateLimited = rateLimitByRequest(request, 'interests:delete', 30, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const { searchParams } = new URL(request.url);
    const id = parsePositiveInteger(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
    
    // Verify ownership
    const existing = await db.query.interests.findFirst({
      where: and(eq(interests.id, id), eq(interests.userId, session.user.id))
    });
    if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
    await db.delete(interests).where(eq(interests.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete interest:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
