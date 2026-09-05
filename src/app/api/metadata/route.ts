import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { safeFetchHtml, SSRFValidationError } from '@/lib/security/ssrf';
import { extractDomain, normalizeUrl } from '@/lib/utils/url';
import { checkRateLimit, getClientIp } from '@/lib/security/rateLimit';
import type { ScrapedMetadata } from '@/types/common';

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // Per-IP Rate Limiting (25 requests / min per IP)
  const rateLimit = checkRateLimit(`metadata:${ip}`, {
    limit: 25,
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

  try {
    const body = await request.json();
    const rawUrl = body?.url;

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json(
        { error: 'A valid url string is required' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const targetUrl = normalizeUrl(rawUrl);
    const domain = extractDomain(targetUrl);

    try {
      const { html, finalUrl } = await safeFetchHtml(targetUrl);
      const $ = cheerio.load(html);

      // 1. Extract Title
      let title =
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').first().text() ||
        $('h1').first().text() ||
        '';
      title = title.trim();

      // 2. Extract Thumbnail Image
      let thumbnailUrl =
        $('meta[property="og:image:secure_url"]').attr('content') ||
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image:src"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('link[rel="image_src"]').attr('href') ||
        '';

      // If thumbnail is relative, resolve with finalUrl
      if (thumbnailUrl && !/^https?:\/\//i.test(thumbnailUrl)) {
        try {
          thumbnailUrl = new URL(thumbnailUrl, finalUrl).href;
        } catch {
          thumbnailUrl = '';
        }
      }

      // 3. Extract Description
      let description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';
      description = description.trim();

      // If title wasn't found, fallback to domain name or url path
      if (!title) {
        title = domain;
      }

      const responseData: ScrapedMetadata = {
        url: finalUrl || targetUrl,
        title,
        thumbnail_url: thumbnailUrl,
        source_domain: domain,
        description,
        fallbackNeeded: !thumbnailUrl || !title,
      };

      return NextResponse.json({
        success: true,
        data: responseData,
      });
    } catch (fetchError: unknown) {
      // If it is an intentional SSRF security block, reject with 400
      if (fetchError instanceof SSRFValidationError) {
        return NextResponse.json(
          { error: fetchError.message },
          { status: 400 }
        );
      }

      // Upstream blocks (403, 429, timeouts, bot challenges like Pinterest/Instagram):
      // Return fallbackNeeded response rather than failing the UI
      return NextResponse.json({
        success: false,
        fallbackNeeded: true,
        data: {
          url: targetUrl,
          title: domain,
          thumbnail_url: '',
          source_domain: domain,
          description: '',
          fallbackNeeded: true,
        } satisfies ScrapedMetadata,
        error: fetchError instanceof Error ? fetchError.message : 'Scraping blocked or failed',
      });
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    );
  }
}
