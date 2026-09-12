import {
  MIN_STORYBOARD_SCALE,
  MAX_STORYBOARD_SCALE,
  type StoryboardViewport,
  type StoryboardPoint,
  type StoryboardBounds,
} from '../types';

export interface ContainerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Clamps viewport scale within established bounds [0.15, 3.0].
 */
export function clampScale(scale: number): number {
  return Math.min(MAX_STORYBOARD_SCALE, Math.max(MIN_STORYBOARD_SCALE, scale));
}

/**
 * Converts screen DOM coordinates (e.g. clientX, clientY) to canvas world coordinates.
 */
export function screenToCanvas(
  clientX: number,
  clientY: number,
  containerRect: ContainerRect,
  viewport: StoryboardViewport
): StoryboardPoint {
  const relX = clientX - containerRect.left;
  const relY = clientY - containerRect.top;

  return {
    x: (relX - viewport.x) / viewport.scale,
    y: (relY - viewport.y) / viewport.scale,
  };
}

/**
 * Converts a stage pointer position (relative to stage container) into canvas world coordinates.
 */
export function stagePointToCanvas(
  point: { x: number; y: number },
  viewport: StoryboardViewport
): StoryboardPoint {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

/**
 * Converts canvas world coordinates into container pixel coordinates.
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewport: StoryboardViewport
): StoryboardPoint {
  return {
    x: canvasX * viewport.scale + viewport.x,
    y: canvasY * viewport.scale + viewport.y,
  };
}

/**
 * Calculates zoom-to-fit viewport given bounding boxes of all items and container dimensions.
 */
export function calculateZoomToFit(
  boundsList: StoryboardBounds[],
  containerWidth: number,
  containerHeight: number,
  padding = 80
): StoryboardViewport {
  if (boundsList.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of boundsList) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  const contentWidth = Math.max(100, maxX - minX);
  const contentHeight = Math.max(100, maxY - minY);

  const availableWidth = Math.max(100, containerWidth - padding * 2);
  const availableHeight = Math.max(100, containerHeight - padding * 2);

  const scaleX = availableWidth / contentWidth;
  const scaleY = availableHeight / contentHeight;
  const targetScale = clampScale(Math.min(scaleX, scaleY, 1.2));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: containerWidth / 2 - centerX * targetScale,
    y: containerHeight / 2 - centerY * targetScale,
    scale: targetScale,
  };
}
