/**
 * Resizes and compresses an image File or Blob on the client to ~400px width
 * using standard HTML5 Canvas before uploading to Supabase Storage.
 */
export async function resizeImageForThumbnail(
  file: File | Blob,
  targetWidth: number = 400,
  quality: number = 0.82
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > targetWidth) {
          height = Math.round((height * targetWidth) / width);
          width = targetWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Image compression failed'));
            }
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Resizes and compresses an image File or Blob on the client for playground canvas placement,
 * maintaining high visual quality while strictly guaranteeing the output blob lands under
 * the Supabase Storage 'thumbnails' bucket limit (1,048,576 bytes).
 */
export async function resizeImageForPlayground(
  file: File | Blob,
  maxDimension: number = 1200,
  initialQuality: number = 0.85
): Promise<{ blob: Blob; width: number; height: number; naturalWidth: number; naturalHeight: number }> {
  // 1MB is 1,048,576 bytes. Target 950KB to leave safe headroom under bucket limit.
  const MAX_TARGET_BYTES = 950 * 1024;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new window.Image();

      img.onload = async () => {
        try {
          const naturalWidth = img.naturalWidth || img.width;
          const naturalHeight = img.naturalHeight || img.height;
          let width = naturalWidth;
          let height = naturalHeight;

          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context unavailable'));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Quality steps to try: initial (0.85), then down to 0.72, 0.60, 0.45
          const qualitySteps = [initialQuality, 0.72, 0.6, 0.45];
          let bestBlob: Blob | null = null;

          for (const q of qualitySteps) {
            const blob = await new Promise<Blob | null>((res) =>
              canvas.toBlob((b) => res(b), 'image/webp', q)
            );
            if (blob) {
              bestBlob = blob;
              if (blob.size <= MAX_TARGET_BYTES) {
                resolve({
                  blob,
                  width,
                  height,
                  naturalWidth,
                  naturalHeight,
                });
                return;
              }
            }
          }

          // If still over 950KB, reduce dimensions in steps (900, 750, 600)
          for (const targetDim of [900, 750, 600]) {
            if (Math.max(width, height) > targetDim) {
              if (naturalWidth >= naturalHeight) {
                width = targetDim;
                height = Math.round((naturalHeight * targetDim) / naturalWidth);
              } else {
                height = targetDim;
                width = Math.round((naturalWidth * targetDim) / naturalHeight);
              }

              canvas.width = width;
              canvas.height = height;
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, width, height);

              for (const q of [0.75, 0.6, 0.45]) {
                const blob = await new Promise<Blob | null>((res) =>
                  canvas.toBlob((b) => res(b), 'image/webp', q)
                );
                if (blob) {
                  bestBlob = blob;
                  if (blob.size <= MAX_TARGET_BYTES) {
                    resolve({
                      blob,
                      width,
                      height,
                      naturalWidth,
                      naturalHeight,
                    });
                    return;
                  }
                }
              }
            }
          }

          if (bestBlob) {
            resolve({
              blob: bestBlob,
              width,
              height,
              naturalWidth,
              naturalHeight,
            });
          } else {
            reject(new Error('Image compression failed to produce a valid image file.'));
          }
        } catch (compErr) {
          reject(compErr instanceof Error ? compErr : new Error('Image compression failed.'));
        }
      };

      img.onerror = () =>
        reject(new Error('Failed to load image for compression. Format may not be supported.'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Probes the natural width and height of an image URL.
 * Resolves within timeoutMs (default 1500ms) or falls back to null.
 */
export function getImageNaturalDimensions(
  url: string,
  timeoutMs = 1500
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !url) {
      resolve(null);
      return;
    }

    const img = new window.Image();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w > 0 && h > 0) {
          resolve({ width: w, height: h });
        } else {
          resolve(null);
        }
      }
    };

    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };

    img.src = url;

    // In case image was already cached by browser
    if (img.complete && (img.naturalWidth || img.width) > 0) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      }
    }
  });
}

