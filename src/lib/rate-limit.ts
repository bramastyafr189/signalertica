import { NextResponse } from 'next/server';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';

  return request.headers.get('x-real-ip') || 'unknown';
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  bucket.count += 1;
  return null;
}

export function rateLimitByRequest(request: Request, scope: string, limit: number, windowMs: number, userId?: string) {
  const actor = userId || getClientIp(request);
  return checkRateLimit({
    key: `${scope}:${actor}`,
    limit,
    windowMs,
  });
}
