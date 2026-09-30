/**
 * shotFrameUtils — Unit Tests
 *
 * Covers Stage 3.4.1 requirements:
 * 1. No visual source → empty-frame path (hasFrame = false)
 * 2. Valid visual URL → correct proxy / direct URL construction
 * 3. Proxy URL routing behaviour
 * 4. Malformed / empty URL handling
 * 5. computeCoverFit geometry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getShotFrameImageUrl,
  shotHasVisualFrame,
  computeCoverFit,
} from '../shotFrameUtils';

// ---------------------------------------------------------------------------
// shotHasVisualFrame
// ---------------------------------------------------------------------------
describe('shotHasVisualFrame', () => {
  it('returns false when visual_source is "none"', () => {
    expect(shotHasVisualFrame('none', 'https://example.com/img.jpg')).toBe(false);
  });

  it('returns false when visual_source is null', () => {
    expect(shotHasVisualFrame(null, 'https://example.com/img.jpg')).toBe(false);
  });

  it('returns false when visual_source is undefined', () => {
    expect(shotHasVisualFrame(undefined, 'https://example.com/img.jpg')).toBe(false);
  });

  it('returns false when visual_url is empty string', () => {
    expect(shotHasVisualFrame('reference', '')).toBe(false);
  });

  it('returns false when visual_url is null', () => {
    expect(shotHasVisualFrame('reference', null)).toBe(false);
  });

  it('returns false when visual_url is undefined', () => {
    expect(shotHasVisualFrame('reference', undefined)).toBe(false);
  });

  it('returns false when visual_url is whitespace only', () => {
    expect(shotHasVisualFrame('reference', '   ')).toBe(false);
  });

  it('returns true when source is "reference" with a non-empty URL', () => {
    expect(shotHasVisualFrame('reference', 'https://example.com/thumb.jpg')).toBe(true);
  });

  it('returns true when source is "upload" with a non-empty URL', () => {
    expect(shotHasVisualFrame('upload', 'https://abc.supabase.co/storage/v1/object/public/thumbnails/p/img.webp')).toBe(true);
  });

  it('returns true when source is "sketch" with a non-empty URL', () => {
    expect(shotHasVisualFrame('sketch', '/relative/path/image.png')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getShotFrameImageUrl — URL resolution behaviour
// ---------------------------------------------------------------------------
describe('getShotFrameImageUrl', () => {
  // We need window to be present for URL parsing and proxy routing.
  // In jsdom (vitest default) window.location.origin is 'http://localhost:3000'.

  beforeEach(() => {
    // Ensure window is defined (vitest with jsdom provides it)
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:3000', href: 'http://localhost:3000/' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty string for null input', () => {
    expect(getShotFrameImageUrl(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(getShotFrameImageUrl(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(getShotFrameImageUrl('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(getShotFrameImageUrl('   ')).toBe('');
  });

  it('passes relative URLs through unchanged', () => {
    expect(getShotFrameImageUrl('/thumbnails/proj-1/image.webp')).toBe('/thumbnails/proj-1/image.webp');
  });

  it('passes data URIs through unchanged', () => {
    const dataUrl = 'data:image/png;base64,abc123';
    expect(getShotFrameImageUrl(dataUrl)).toBe(dataUrl);
  });

  it('passes blob URLs through unchanged', () => {
    const blobUrl = 'blob:http://localhost:3000/some-uuid';
    expect(getShotFrameImageUrl(blobUrl)).toBe(blobUrl);
  });

  it('returns Supabase Storage public URL directly (no proxy needed — CORS is permissive)', () => {
    const supabaseUrl = 'https://abcdefg.supabase.co/storage/v1/object/public/thumbnails/proj/img.webp';
    expect(getShotFrameImageUrl(supabaseUrl)).toBe(supabaseUrl);
  });

  it('routes external URLs through /api/proxy-image', () => {
    const externalUrl = 'https://pinimg.com/originals/00/00/some-thumb.jpg';
    const result = getShotFrameImageUrl(externalUrl);
    expect(result).toMatch(/^\/api\/proxy-image\?url=/);
    expect(result).toContain(encodeURIComponent(externalUrl));
  });

  it('routes HTTPS external URLs that are not Supabase through proxy', () => {
    const externalUrl = 'https://i.imgur.com/someimage.jpg';
    const result = getShotFrameImageUrl(externalUrl);
    expect(result.startsWith('/api/proxy-image?')).toBe(true);
  });

  it('returns same-origin URLs directly (no proxy)', () => {
    const sameOriginUrl = 'http://localhost:3000/api/some-image';
    expect(getShotFrameImageUrl(sameOriginUrl)).toBe(sameOriginUrl);
  });

  it('handles malformed URL strings without throwing', () => {
    // A string that is not a valid URL — should not throw, returns as-is
    const malformed = 'not a valid url at all ://??##';
    const result = getShotFrameImageUrl(malformed);
    // Result is either the original string or wrapped in proxy — the key is it doesn't throw
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// getShotFrameImageUrl — SSR guard
// ---------------------------------------------------------------------------
describe('getShotFrameImageUrl — SSR / window-undefined guard', () => {
  it('returns the raw URL when window is undefined (SSR context)', () => {
    // Simulate SSR by removing window
    const originalWindow = globalThis.window;
    // @ts-expect-error intentionally deleting window for SSR simulation
    delete globalThis.window;

    const externalUrl = 'https://example.com/image.jpg';
    const result = getShotFrameImageUrl(externalUrl);
    // In SSR: returns URL as-is (no proxy, because URL routing needs window.location)
    expect(result).toBe(externalUrl);

    globalThis.window = originalWindow;
  });
});

// ---------------------------------------------------------------------------
// computeCoverFit
// ---------------------------------------------------------------------------
describe('computeCoverFit', () => {
  it('returns identity fit when natural and frame dimensions are equal', () => {
    const result = computeCoverFit(200, 150, 200, 150);
    expect(result.drawW).toBe(200);
    expect(result.drawH).toBe(150);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('cover-fits a wide image into a square frame (crops left/right)', () => {
    // 16:9 image (1920×1080) → 1:1 frame (200×200)
    const result = computeCoverFit(1920, 1080, 200, 200);
    // scaleX = 200/1920 ≈ 0.104, scaleY = 200/1080 ≈ 0.185
    // cover scale = max → scaleY ≈ 0.185
    // drawW = 1920 * 0.185 ≈ 355.6, drawH = 200
    expect(result.drawH).toBeCloseTo(200, 0);
    expect(result.drawW).toBeGreaterThan(200); // image wider than frame → cropped
    expect(result.offsetX).toBeLessThan(0);    // negative offset → crops symmetrically
    expect(result.offsetY).toBeCloseTo(0, 1);
  });

  it('cover-fits a tall image into a wide frame (crops top/bottom)', () => {
    // 9:16 image (1080×1920) → 16:9 frame (268×151)
    const result = computeCoverFit(1080, 1920, 268, 151);
    // scaleX = 268/1080 ≈ 0.248, scaleY = 151/1920 ≈ 0.079
    // cover scale = max → scaleX ≈ 0.248
    // drawH = 1920 * 0.248 ≈ 476 > 151 → crops top/bottom
    expect(result.drawW).toBeCloseTo(268, 0);
    expect(result.drawH).toBeGreaterThan(151);
    expect(result.offsetY).toBeLessThan(0);  // crops top and bottom symmetrically
    expect(result.offsetX).toBeCloseTo(0, 1);
  });

  it('returns safe fallback for zero naturalW', () => {
    const result = computeCoverFit(0, 100, 200, 150);
    expect(result.drawW).toBe(200);
    expect(result.drawH).toBe(150);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('returns safe fallback for zero naturalH', () => {
    const result = computeCoverFit(100, 0, 200, 150);
    expect(result).toEqual({ drawW: 200, drawH: 150, offsetX: 0, offsetY: 0 });
  });

  it('returns safe fallback for zero frameW', () => {
    const result = computeCoverFit(100, 100, 0, 150);
    expect(result).toEqual({ drawW: 0, drawH: 150, offsetX: 0, offsetY: 0 });
  });

  it('returns safe fallback for NaN input', () => {
    const result = computeCoverFit(NaN, 100, 200, 150);
    expect(result).toEqual({ drawW: 200, drawH: 150, offsetX: 0, offsetY: 0 });
  });

  it('cover-fits an image with exact same aspect ratio as the frame (near-zero crop)', () => {
    // 16:9 image → 16:9 frame. Due to integer pixel frame dimensions (268×151 is not exactly 16:9),
    // there will be a tiny sub-pixel offset. We verify both draw dimensions fill the frame and that
    // at least one offset axis is at or near zero (the shorter axis fills exactly).
    const result = computeCoverFit(1600, 900, 268, 151);
    // Both axes should be approximately equal to the frame dimensions
    expect(result.drawW).toBeCloseTo(268, 0);
    expect(result.drawH).toBeCloseTo(151, 0);
    // The offset on the non-cropped axis is sub-pixel (< 1px), not large
    const minAbsOffset = Math.min(Math.abs(result.offsetX), Math.abs(result.offsetY));
    expect(minAbsOffset).toBeLessThan(1);
  });
});
