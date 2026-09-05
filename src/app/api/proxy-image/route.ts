import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeFetchImage, SSRFValidationError } from '@/lib/security/ssrf';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';

export async function GET(request: Request) {
  const ip = getClientIp(request);

  // 1. Per-IP Rate Limiting (75 requests / min per IP)
  const rateLimit = checkRateLimit(`proxy-image:${ip}`, {
    limit: 75,
    windowMs: 60 * 1000,
  });

  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(rateLimit.limit),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(rateLimit.reset),
  };

  if (!rateLimit.success) {
    const retryAfter = Math.max(1, rateLimit.reset - Math.ceil(Date.now() / 1000));
    return NextResponse.json(
      { error: 'Too many requests, please try again later.' },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');
  const token = searchParams.get('token');

  // 2. Authentication & Real Database Share Token Verification
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Precise status code: no session and no token -> 401 Unauthorized
    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: 'Authentication required. No session or share token provided.' },
        { status: 401, headers: rateLimitHeaders }
      );
    }

    // Precise status code: token present but invalid/expired/revoked -> 403 Forbidden
    const { data: sharedBundle, error: rpcError } = await supabase.rpc(
      'get_shared_project_bundle',
      { p_token: token.trim() }
    );

    const isValidSharedProject =
      !rpcError &&
      sharedBundle &&
      typeof sharedBundle === 'object' &&
      (sharedBundle as { project?: { id?: string } }).project?.id;

    if (!isValidSharedProject) {
      return NextResponse.json(
        { error: 'Invalid, revoked, or expired project share token.' },
        { status: 403, headers: rateLimitHeaders }
      );
    }
  }

  // 3. Validate Target Image URL
  if (!rawUrl || typeof rawUrl !== 'string') {
    return NextResponse.json(
      { error: 'A valid url query parameter is required.' },
      { status: 400, headers: rateLimitHeaders }
    );
  }

  // 4. Safe Fetch Image with SSRF Protection and IP Pinning
  try {
    const { buffer, contentType } = await safeFetchImage(rawUrl);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...rateLimitHeaders,
        'Content-Type': contentType,
        // Cache heavily on client and edge to eliminate redundant upstream calls during canvas zoom/pan
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    if (err instanceof SSRFValidationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const message = err instanceof Error ? err.message : 'Upstream image fetch failed';
    return NextResponse.json(
      { error: message },
      { status: 502, headers: rateLimitHeaders }
    );
  }
}
