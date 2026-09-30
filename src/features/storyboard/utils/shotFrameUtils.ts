/**
 * shotFrameUtils.ts
 *
 * Utilities for resolving and validating visual frame image URLs in the Storyboard.
 *
 * IMAGE PROXY RATIONALE
 * ---------------------
 * External cross-origin images without permissive CORS headers will taint the HTML5
 * Canvas element when drawn via Konva, causing `stage.toDataURL()` to throw a
 * DOMException ("The operation is insecure"). Proxying through the same-origin
 * /api/proxy-image route keeps canvas pixels untainted for export while maintaining
 * SSRF/CORS protections already in place on that endpoint.
 *
 * Special cases that need NO proxy:
 * - Relative / same-origin URLs (already same-origin)
 * - data: URLs (inline, no network request)
 * - blob: URLs (local browser object)
 * - Supabase Storage public objects:  *.supabase.co/storage/v1/object/public/*
 *   These send `Access-Control-Allow-Origin: *` and can be fetched with
 *   `crossOrigin = 'anonymous'` without tainting.
 *
 * IMAGE FIT DECISION: COVER (CSS object-fit: cover equivalent)
 * -------------------------------------------------------------
 * The shot frame has a fixed aspect ratio (controlled by calculateShotDimensions).
 * The source image may have a different natural aspect ratio (e.g. a landscape
 * thumbnail used in a 9:16 vertical frame). We render the image at cover scale —
 * scaled so the shorter dimension fills the frame exactly, with the excess centred
 * and clipped by the frame's clipRect. This:
 *   1. Never distorts the image.
 *   2. Always fills the frame (no letterbox/pillarbox empty areas).
 *   3. Is consistent with how reference thumbnails render in the moodboard.
 *   4. Requires the frame Group to have clipX/clipY/clipWidth/clipHeight set.
 */

/**
 * Resolves a visual frame URL to a canvas-safe URL.
 * External URLs are routed through /api/proxy-image to avoid CORS canvas taint.
 * Returns an empty string for falsy / invalid inputs so callers can guard easily.
 */
export function getShotFrameImageUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return '';
  }

  const url = rawUrl.trim();

  // SSR guard: window is not available during server-side rendering.
  if (typeof window === 'undefined') {
    return url;
  }

  // Relative URLs, data URIs and blob URLs are already local — no proxy needed.
  if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  try {
    const parsed = new URL(url, window.location.href);

    // Same-origin: no proxy needed.
    if (parsed.origin === window.location.origin) {
      return url;
    }

    // Supabase Storage public objects serve permissive CORS headers:
    // no proxy needed, direct anonymous fetch works.
    if (
      parsed.hostname.endsWith('supabase.co') &&
      parsed.pathname.includes('/storage/v1/object/public/')
    ) {
      return url;
    }

    // All other external URLs: proxy through the same-origin endpoint.
    const params = new URLSearchParams();
    params.set('url', url);
    return `/api/proxy-image?${params.toString()}`;
  } catch {
    // URL constructor threw — malformed URL. Return as-is; useImage will handle
    // the failure gracefully (imageStatus === 'failed').
    return url;
  }
}

/**
 * Returns true when a shot has a renderable visual frame.
 * Both conditions must hold: source is not 'none' AND url is non-empty.
 */
export function shotHasVisualFrame(
  visualSource: string | null | undefined,
  visualUrl: string | null | undefined
): boolean {
  if (!visualSource || visualSource === 'none') return false;
  if (!visualUrl || !visualUrl.trim()) return false;
  return true;
}

/**
 * Computes cover-fit dimensions so an image of `naturalW × naturalH` fills a
 * target frame of `frameW × frameH` without distortion.
 *
 * Returns { drawW, drawH, offsetX, offsetY } where:
 *   drawW / drawH  — the image dimensions to pass to KonvaImage
 *   offsetX / offsetY — how far to offset the top-left corner so the image
 *                       is centred within the frame (will be ≤ 0 on the crop axis)
 *
 * The caller is responsible for applying a clipRect on the containing Group so
 * the overflowing portions are hidden.
 */
export function computeCoverFit(
  naturalW: number,
  naturalH: number,
  frameW: number,
  frameH: number
): { drawW: number; drawH: number; offsetX: number; offsetY: number } {
  // Guard against degenerate inputs
  if (
    !Number.isFinite(naturalW) || naturalW <= 0 ||
    !Number.isFinite(naturalH) || naturalH <= 0 ||
    !Number.isFinite(frameW)   || frameW   <= 0 ||
    !Number.isFinite(frameH)   || frameH   <= 0
  ) {
    return { drawW: frameW, drawH: frameH, offsetX: 0, offsetY: 0 };
  }

  const scaleX = frameW / naturalW;
  const scaleY = frameH / naturalH;
  // Cover: pick the LARGER scale so the image fills the frame on both axes.
  const scale = Math.max(scaleX, scaleY);

  const drawW = naturalW * scale;
  const drawH = naturalH * scale;

  // Centre the oversized image so the crop is symmetric.
  const offsetX = (frameW - drawW) / 2;
  const offsetY = (frameH - drawH) / 2;

  return { drawW, drawH, offsetX, offsetY };
}
