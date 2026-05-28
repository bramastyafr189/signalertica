import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { parseOptionalBoolean, readJsonRecord } from '@/lib/api-validation';
import { isAdminSession } from '@/lib/authz';
import { rateLimitByRequest } from '@/lib/rate-limit';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rateLimited = rateLimitByRequest(req, 'settings:get', 60, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const settings = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.id, 'global')
    });

    return NextResponse.json(settings || { id: 'global', isSyncEnabled: true });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rateLimited = rateLimitByRequest(req, 'settings:post', 20, 60_000, session.user.id);
    if (rateLimited) return rateLimited;

    const body = await readJsonRecord(req);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const isSyncEnabled = parseOptionalBoolean(body.isSyncEnabled);
    if (isSyncEnabled === undefined) {
      return NextResponse.json({ error: 'isSyncEnabled must be boolean' }, { status: 400 });
    }

    await db.insert(systemSettings)
      .values({ 
        id: 'global', 
        isSyncEnabled, 
        updatedAt: new Date() 
      })
      .onConflictDoUpdate({
        target: systemSettings.id,
        set: { 
          isSyncEnabled, 
          updatedAt: new Date() 
        }
      });

    return NextResponse.json({ success: true, isSyncEnabled });
  } catch (error) {
    console.error('[SETTINGS_API] Update failed:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
