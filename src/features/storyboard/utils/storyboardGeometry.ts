import type { AspectRatio, StoryboardBounds, StoryboardPoint } from '../types';

export interface ShotDimensions {
  cardWidth: number;
  frameHeight: number;
  totalHeight: number;
}

export const DEFAULT_SHOT_WIDTH = 280;
export const SCENE_HEADER_HEIGHT = 44;
export const SCENE_MIN_WIDTH = 420;
export const SCENE_MIN_HEIGHT = 320;
export const SCENE_PADDING = 24;

/**
 * Calculate shot card frame height and total card height based on aspect ratio and card width.
 */
export function calculateShotDimensions(
  aspectRatio: AspectRatio = '16:9',
  cardWidth: number = DEFAULT_SHOT_WIDTH
): ShotDimensions {
  const width = Math.max(160, cardWidth);
  let frameHeight: number;

  switch (aspectRatio) {
    case '9:16':
      frameHeight = Math.round(width * (16 / 9));
      break;
    case '1:1':
      frameHeight = width;
      break;
    case '4:3':
      frameHeight = Math.round(width * (3 / 4));
      break;
    case '16:9':
    default:
      frameHeight = Math.round(width * (9 / 16));
      break;
  }

  // Info section below frame:
  // - Top padding & shot number / title row: ~28px
  // - Description row: ~20px
  // - Metadata tags row: ~22px
  // - Bottom padding: ~12px
  const infoSectionHeight = 82;
  const totalHeight = frameHeight + infoSectionHeight;

  return {
    cardWidth: width,
    frameHeight,
    totalHeight,
  };
}

/**
 * Compute the next placement position for a newly created Scene.
 * Spaced to the right of existing scenes, or centered if none exist.
 */
export function calculateNextScenePosition(
  existingScenes: Array<{ x: number; y: number; width: number; height: number }>,
  viewport?: { x: number; y: number; scale: number }
): { x: number; y: number } {
  if (existingScenes.length === 0) {
    if (viewport && viewport.scale > 0) {
      // Place near viewport origin in world coordinates
      const worldX = Math.round((-viewport.x + 120) / viewport.scale);
      const worldY = Math.round((-viewport.y + 120) / viewport.scale);
      return { x: Math.max(60, worldX), y: Math.max(60, worldY) };
    }
    return { x: 100, y: 100 };
  }

  // Find right-most scene boundary
  let maxRight = 0;
  let topY = existingScenes[0].y;

  for (const scene of existingScenes) {
    const right = scene.x + scene.width;
    if (right > maxRight) {
      maxRight = right;
      topY = scene.y;
    }
  }

  return {
    x: maxRight + 80,
    y: topY,
  };
}

/**
 * Compute the next placement position for a newly created Shot inside a target Scene.
 * Places shots in a neat flow layout inside the scene boundary.
 */
export function calculateNextShotPosition(
  scene: { x: number; y: number; width: number; height: number },
  existingShotsInScene: Array<{ x: number; y: number; width: number; height: number }>,
  newShotAspectRatio: AspectRatio = '16:9'
): { x: number; y: number } {
  const { cardWidth, totalHeight } = calculateShotDimensions(newShotAspectRatio);
  const startX = scene.x + SCENE_PADDING;
  const startY = scene.y + SCENE_HEADER_HEIGHT + SCENE_PADDING;

  if (existingShotsInScene.length === 0) {
    return { x: startX, y: startY };
  }

  // Calculate available columns in the scene width
  const horizontalGap = 24;
  const verticalGap = 24;
  const availableWidth = Math.max(scene.width - SCENE_PADDING * 2, cardWidth);
  const maxCols = Math.max(1, Math.floor((availableWidth + horizontalGap) / (cardWidth + horizontalGap)));

  const count = existingShotsInScene.length;
  const col = count % maxCols;
  const row = Math.floor(count / maxCols);

  return {
    x: startX + col * (cardWidth + horizontalGap),
    y: startY + row * (totalHeight + verticalGap),
  };
}

/**
 * Calculate the new positions of all member shots when their parent Scene moves by (dx, dy).
 * Preserves exact relative spatial offsets.
 */
export function calculateMemberShotsDelta<T extends { id: string; scene_id: string; x: number; y: number }>(
  shots: T[],
  sceneId: string,
  dx: number,
  dy: number
): Array<{ id: string; x: number; y: number }> {
  return shots
    .filter((shot) => shot.scene_id === sceneId)
    .map((shot) => ({
      id: shot.id,
      x: Math.round(shot.x + dx),
      y: Math.round(shot.y + dy),
    }));
}

/**
 * Check whether a point (e.g. pointer release or card center) lies directly over a scene's header bar.
 * Deliberate drop zone is strictly the header bar, NOT the scene body.
 */
export function isPointOverSceneHeader(
  point: StoryboardPoint,
  scene: { x: number; y: number; width: number; height: number },
  headerHeight: number = SCENE_HEADER_HEIGHT
): boolean {
  return (
    point.x >= scene.x &&
    point.x <= scene.x + scene.width &&
    point.y >= scene.y &&
    point.y <= scene.y + headerHeight
  );
}

/**
 * Detect which shots intersect with a rectangular marquee selection box (AABB collision).
 */
export function findIntersectingShots<T extends { id: string; x: number; y: number; width: number; height: number }>(
  shots: T[],
  marquee: StoryboardBounds
): string[] {
  // Normalize marquee bounds in case drawn backwards
  const minX = Math.min(marquee.x, marquee.x + marquee.width);
  const maxX = Math.max(marquee.x, marquee.x + marquee.width);
  const minY = Math.min(marquee.y, marquee.y + marquee.height);
  const maxY = Math.max(marquee.y, marquee.y + marquee.height);

  const intersectingIds: string[] = [];

  for (const shot of shots) {
    const shotLeft = shot.x;
    const shotRight = shot.x + shot.width;
    const shotTop = shot.y;
    const shotBottom = shot.y + shot.height;

    // AABB intersection check
    const isIntersecting = !(
      shotRight < minX ||
      shotLeft > maxX ||
      shotBottom < minY ||
      shotTop > maxY
    );

    if (isIntersecting) {
      intersectingIds.push(shot.id);
    }
  }

  return intersectingIds;
}
