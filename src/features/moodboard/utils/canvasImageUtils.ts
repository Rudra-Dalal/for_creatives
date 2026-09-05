/**
 * Utility to resolve canvas-safe image URLs.
 *
 * External cross-origin images without permissive CORS headers will taint the HTML5 Canvas,
 * which causes Konva's stage.toDataURL() export to throw a DOMException:
 * "The operation is insecure".
 *
 * By proxying external images through our same-origin /api/proxy-image route, all canvas pixels
 * remain untainted without needing to re-host or store files in Supabase Storage.
 */
export function getCanvasSafeImageUrl(imageUrl: string, shareToken?: string): string {
  if (!imageUrl || typeof window === 'undefined') return imageUrl;

  // Local relative URLs, data URLs, and blob URLs are already same-origin / local
  if (
    imageUrl.startsWith('/') ||
    imageUrl.startsWith('data:') ||
    imageUrl.startsWith('blob:')
  ) {
    return imageUrl;
  }

  try {
    const parsed = new URL(imageUrl, window.location.href);

    // If exact same origin as the current web app, no proxy needed
    if (parsed.origin === window.location.origin) {
      return imageUrl;
    }

    // Supabase Storage public objects send 'access-control-allow-origin: *'
    // and can be safely loaded directly with crossOrigin = 'anonymous'
    if (
      parsed.hostname.endsWith('supabase.co') &&
      parsed.pathname.includes('/storage/v1/object/public/')
    ) {
      return imageUrl;
    }

    // External image: proxy through same-origin endpoint
    const params = new URLSearchParams();
    params.set('url', imageUrl);
    if (shareToken && shareToken.trim()) {
      params.set('token', shareToken.trim());
    }

    return `/api/proxy-image?${params.toString()}`;
  } catch {
    return imageUrl;
  }
}
