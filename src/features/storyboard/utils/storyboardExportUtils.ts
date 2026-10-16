import type {
  AspectRatio,
  StoryboardBounds,
  StoryboardScene,
  StoryboardSceneWithShots,
  StoryboardShot,
  StoryboardShotWithLinks,
  StoryboardStroke,
} from '../types';
import { calculateShotDimensions, DEFAULT_SHOT_WIDTH } from './storyboardGeometry';

export interface StoryboardExportBoundsOptions {
  scenes: Array<StoryboardSceneWithShots | StoryboardScene>;
  shots?: Array<StoryboardShotWithLinks | StoryboardShot>;
  strokes?: StoryboardStroke[];
  padding?: number;
  selectedShotIds?: Set<string> | string[];
  selectedSceneId?: string | null;
  mode?: 'all' | 'selection';
}

export interface StageExportConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio: number;
  mimeType: string;
}

/**
 * Calculates the bounding box in world coordinates covering all visual storyboard elements
 * (scenes, shots, and freehand strokes) or the active selection.
 */
export function calculateStoryboardExportBounds(
  options: StoryboardExportBoundsOptions
): StoryboardBounds | null {
  const {
    scenes,
    strokes = [],
    padding = 40,
    selectedShotIds,
    selectedSceneId,
    mode = 'all',
  } = options;

  // Resolve all non-deleted shots across scenes or explicit shots prop
  const allShots: Array<StoryboardShotWithLinks | StoryboardShot> = [];
  if (options.shots && options.shots.length > 0) {
    for (const shot of options.shots) {
      if (!shot.deleted_at) {
        allShots.push(shot);
      }
    }
  } else {
    for (const scene of scenes) {
      if (!scene.deleted_at && 'shots' in scene && Array.isArray(scene.shots)) {
        for (const shot of scene.shots) {
          if (!shot.deleted_at) {
            allShots.push(shot);
          }
        }
      }
    }
  }

  const nonDeletedScenes = scenes.filter((s) => !s.deleted_at);
  const nonDeletedStrokes = strokes.filter((s) => !s.deleted_at);

  let targetScenes = nonDeletedScenes;
  let targetShots = allShots;
  let targetStrokes = nonDeletedStrokes;

  // If selection mode is requested, restrict targets to selected elements
  if (mode === 'selection') {
    const shotIdSet =
      selectedShotIds instanceof Set
        ? selectedShotIds
        : new Set(selectedShotIds || []);

    const hasShotSelection = shotIdSet.size > 0;
    const hasSceneSelection = Boolean(selectedSceneId);

    if (hasShotSelection || hasSceneSelection) {
      if (hasShotSelection) {
        targetShots = allShots.filter((s) => shotIdSet.has(s.id));
        // Only include scenes containing selected shots
        const sceneIdsOfSelectedShots = new Set(targetShots.map((s) => s.scene_id));
        targetScenes = nonDeletedScenes.filter((s) => sceneIdsOfSelectedShots.has(s.id));
      } else if (hasSceneSelection) {
        targetScenes = nonDeletedScenes.filter((s) => s.id === selectedSceneId);
        targetShots = allShots.filter((s) => s.scene_id === selectedSceneId);
      }
      // In selection mode, strokes outside selected bounds are omitted unless explicitly included
      targetStrokes = [];
    }
  }

  // Check if anything visual exists
  if (
    targetScenes.length === 0 &&
    targetShots.length === 0 &&
    targetStrokes.length === 0
  ) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // 1. Scene regions
  for (const scene of targetScenes) {
    minX = Math.min(minX, scene.x);
    minY = Math.min(minY, scene.y);
    maxX = Math.max(maxX, scene.x + scene.width);
    maxY = Math.max(maxY, scene.y + scene.height);
  }

  // 2. Shot cards
  for (const shot of targetShots) {
    const width = shot.width || DEFAULT_SHOT_WIDTH;
    const { totalHeight } = calculateShotDimensions(
      (shot.aspect_ratio as AspectRatio) || '16:9',
      width
    );
    const height = shot.height || totalHeight;

    minX = Math.min(minX, shot.x);
    minY = Math.min(minY, shot.y);
    maxX = Math.max(maxX, shot.x + width);
    maxY = Math.max(maxY, shot.y + height);
  }

  // 3. Canvas freehand strokes
  for (const stroke of targetStrokes) {
    const rawPoints = (stroke.points as unknown) as number[];
    if (!Array.isArray(rawPoints) || rawPoints.length < 2) continue;
    const halfWidth = ((stroke.stroke_width as number) || 2) / 2;

    for (let i = 0; i < rawPoints.length; i += 2) {
      const px = Number(rawPoints[i]);
      const py = Number(rawPoints[i + 1]);

      if (Number.isFinite(px) && Number.isFinite(py)) {
        minX = Math.min(minX, px - halfWidth);
        minY = Math.min(minY, py - halfWidth);
        maxX = Math.max(maxX, px + halfWidth);
        maxY = Math.max(maxY, py + halfWidth);
      }
    }
  }

  // If somehow all items were invalid or empty
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  const safePadding = Math.max(0, padding);
  minX -= safePadding;
  minY -= safePadding;
  maxX += safePadding;
  maxY += safePadding;

  const width = Math.max(100, maxX - minX);
  const height = Math.max(100, maxY - minY);

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Calculates Konva stage export parameters for stage.toDataURL().
 * Adjusts scale and pixel ratio so that output PNG is crisp (effective 2x)
 * regardless of whether the user is zoomed out or in, capped safely against GPU limits.
 */
export function calculateStageExportConfig(
  bounds: StoryboardBounds,
  stage: { scaleX?: () => number; x?: () => number; y?: () => number },
  options?: { maxDimension?: number }
): StageExportConfig {
  const currentScale = typeof stage.scaleX === 'function' ? stage.scaleX() || 1 : 1;
  const currentX = typeof stage.x === 'function' ? stage.x() || 0 : 0;
  const currentY = typeof stage.y === 'function' ? stage.y() || 0 : 0;

  const screenX = bounds.x * currentScale + currentX;
  const screenY = bounds.y * currentScale + currentY;
  const screenWidth = bounds.width * currentScale;
  const screenHeight = bounds.height * currentScale;

  // Aim for ~2x world crispness without blowing past max GPU canvas dimensions
  let pixelRatio = Math.max(1, 2 / currentScale);
  const maxDimension = options?.maxDimension || 8192;

  if (screenWidth * pixelRatio > maxDimension) {
    pixelRatio = maxDimension / screenWidth;
  }
  if (screenHeight * pixelRatio > maxDimension) {
    pixelRatio = Math.min(pixelRatio, maxDimension / screenHeight);
  }

  // Safe bounds [1, 4]
  pixelRatio = Math.min(4, Math.max(1, pixelRatio));

  return {
    x: screenX,
    y: screenY,
    width: screenWidth,
    height: screenHeight,
    pixelRatio,
    mimeType: 'image/png',
  };
}

/**
 * Sanitizes a project title into a clean filename for PNG export.
 */
export function sanitizeExportFilename(
  projectName?: string,
  suffix = 'storyboard'
): string {
  const base = (projectName || 'creative')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || 'creative'}-${suffix}.png`;
}

/**
 * Composites the exported image with a solid dark surface background (#121110)
 * so that transparent stage margins render cleanly in image viewers.
 */
export async function compositeExportWithBackground(
  dataUrl: string,
  backgroundColor = '#121110'
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }

  try {
    const img = new Image();
    img.src = dataUrl;

    if (typeof img.decode === 'function') {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image failed to load'));
      });
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw exported canvas content
    ctx.drawImage(img, 0, 0);

    return canvas.toDataURL('image/png');
  } catch (err) {
    // If compositing fails, return original dataUrl gracefully
    console.warn('Canvas compositing fallback to raw data URL:', err);
    return dataUrl;
  }
}

/**
 * Triggers a client-side file download for the given data URL.
 */
export function triggerDownload(dataUrl: string, filename: string): void {
  if (typeof document === 'undefined') return;

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
