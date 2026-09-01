/**
 * Client-side Algorithmic Color Palette Extraction
 * Extracts dominant, harmonious colors directly from reference thumbnail images in-browser.
 * Zero external dependencies / APIs.
 */

export async function extractPaletteFromImage(
  imageUrl: string,
  maxColors = 5
): Promise<string[]> {
  if (!imageUrl || typeof window === 'undefined') {
    return [];
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      resolve([]);
    }, 4000);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve([]);
          return;
        }

        const size = 64;
        canvas.width = size;
        canvas.height = size;

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        // Color bucketing with 4-bit quantization (16 levels per channel = 4096 bins)
        const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent or semi-transparent pixels
          if (a < 128) continue;

          // Skip pure black/white extreme highlights to prioritize tonal accents
          const isExtreme = (r < 12 && g < 12 && b < 12) || (r > 248 && g > 248 && b > 248);

          // 4-bit quantization
          const qR = Math.floor(r / 24) * 24;
          const qG = Math.floor(g / 24) * 24;
          const qB = Math.floor(b / 24) * 24;
          const key = `${qR},${qG},${qB}`;

          const existing = colorBuckets.get(key);
          if (existing) {
            existing.count += isExtreme ? 0.3 : 1;
          } else {
            colorBuckets.set(key, { r: qR, g: qG, b: qB, count: isExtreme ? 0.3 : 1 });
          }
        }

        // Sort by frequency
        const sorted = Array.from(colorBuckets.values()).sort((a, b) => b.count - a.count);

        // Select distinct colors (ensure minimum Euclidean distance in RGB space)
        const distinctColors: { r: number; g: number; b: number }[] = [];
        const minDistanceSq = 35 * 35; // Distinct threshold

        for (const candidate of sorted) {
          if (distinctColors.length >= maxColors) break;

          const isTooClose = distinctColors.some((c) => {
            const dr = c.r - candidate.r;
            const dg = c.g - candidate.g;
            const db = c.b - candidate.b;
            return dr * dr + dg * dg + db * db < minDistanceSq;
          });

          if (!isTooClose) {
            distinctColors.push(candidate);
          }
        }

        // Convert to HEX strings
        const hexPalette = distinctColors.map((c) => {
          const hexR = Math.min(255, Math.max(0, Math.round(c.r))).toString(16).padStart(2, '0');
          const hexG = Math.min(255, Math.max(0, Math.round(c.g))).toString(16).padStart(2, '0');
          const hexB = Math.min(255, Math.max(0, Math.round(c.b))).toString(16).padStart(2, '0');
          return `#${hexR}${hexG}${hexB}`.toUpperCase();
        });

        resolve(hexPalette);
      } catch {
        // Tainted canvas or CORS restriction
        resolve([]);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve([]);
    };

    img.src = imageUrl;
  });
}
