import { NextResponse } from 'next/server';
import { getNewsOnServer } from '@/lib/news-fetcher';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { rateLimitByRequest } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = rateLimitByRequest(request, 'news:get', 60, 60_000, session.user.id);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const lang = searchParams.get('lang') || 'any';
  const country = searchParams.get('country') || 'any';
  
  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  if (q.length > 500) {
    return NextResponse.json({ error: 'Query parameter "q" is too long' }, { status: 400 });
  }

  try {
    const articles = await getNewsOnServer(q, lang, country);
    return NextResponse.json(articles);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
