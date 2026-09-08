import {
  CLICK_VS_DRAG_THRESHOLD_PX,
  MIN_CANVAS_SCALE,
  MAX_CANVAS_SCALE,
  CORNER_PRIORITY_ZONE_PX,
} from './constants';
import type {
  CanvasPoint,
  CanvasBounds,
  ViewportTransform,
  ContainerRect,
} from './geometryTypes';

/**
 * Minimal interface representing a Konva Stage instance with pointer and transform getters.
 */
export interface KonvaStageLike {
  getPointerPosition: () => CanvasPoint | null;
  scaleX?: () => number;
  scaleY?: () => number;
  x?: () => number;
  y?: () => number;
}

/**
 * Converts DOM screen coordinates (e.g. clientX, clientY from pointer events, clipboard,
 * or desktop file drag-and-drop) into canvas world coordinates.
 */
export function screenToCanvas(
  clientX: number,
  clientY: number,
  containerRect: ContainerRect,
  viewport: ViewportTransform
): CanvasPoint {
  const relX = clientX - containerRect.left;
  const relY = clientY - containerRect.top;

  return {
    x: (relX - viewport.x) / viewport.scale,
    y: (relY - viewport.y) / viewport.scale,
  };
}

/**
 * Converts canvas world coordinates into container-relative pixel coordinates.
 * Used for positioning DOM overlays (e.g. inline text note editor, color swatch editor,
 * connector midpoint labels) within a relative-positioned stage container.
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewport: ViewportTransform
): CanvasPoint {
  return {
    x: canvasX * viewport.scale + viewport.x,
    y: canvasY * viewport.scale + viewport.y,
  };
}

/**
 * Converts canvas world coordinates into absolute client window coordinates.
 * Useful for portal-level DOM overlays or tooltip positioning.
 */
export function canvasToClient(
  canvasX: number,
  canvasY: number,
  viewport: ViewportTransform,
  containerRect: ContainerRect
): CanvasPoint {
  const containerPt = canvasToScreen(canvasX, canvasY, viewport);
  return {
    x: containerPt.x + containerRect.left,
    y: containerPt.y + containerRect.top,
  };
}

/**
 * Pure function: converts a stage pointer point (relative to Konva stage container)
 * into canvas world coordinates.
 */
export function pointToCanvas(
  stagePointer: CanvasPoint,
  viewport: ViewportTransform
): CanvasPoint {
  return {
    x: (stagePointer.x - viewport.x) / viewport.scale,
    y: (stagePointer.y - viewport.y) / viewport.scale,
  };
}

/**
 * Converts a screen-space pixel distance or radius to canvas world distance.
 * When zooming the canvas, dividing by viewport scale ensures tools with fixed physical
 * screen dimensions (e.g. eraser radius) maintain the exact same physical size on screen.
 */
export function screenDistanceToCanvas(screenDistance: number, scale: number): number {
  const safeScale = Math.max(0.001, scale);
  return screenDistance / safeScale;
}

/**
 * Converts a canvas world distance to screen-space pixel distance.
 */
export function canvasDistanceToScreen(canvasDistance: number, scale: number): number {
  return canvasDistance * scale;
}

/**
 * Extracts the exact canvas world coordinates from an active Konva Stage instance.
 * Falls back to the authoritative ViewportTransform when stage transforms are initializing.
 */
export function getPointerCanvasPosition(
  stage: KonvaStageLike | null,
  viewport?: ViewportTransform
): CanvasPoint | null {
  if (!stage) return null;

  const pointer = stage.getPointerPosition();
  if (!pointer) return null;

  // Use live Konva transform values if available, falling back to viewport state
  const scaleX = stage.scaleX ? stage.scaleX() : (viewport ? viewport.scale : 1);
  const scaleY = stage.scaleY ? stage.scaleY() : (viewport ? viewport.scale : 1);
  const stageX = stage.x ? stage.x() : (viewport ? viewport.x : 0);
  const stageY = stage.y ? stage.y() : (viewport ? viewport.y : 0);

  const safeScaleX = scaleX || 1;
  const safeScaleY = scaleY || 1;

  return {
    x: (pointer.x - (stageX ?? 0)) / safeScaleX,
    y: (pointer.y - (stageY ?? 0)) / safeScaleY,
  };
}

/**
 * Standardizes hit-testing thresholds and snap radii into canvas units so that
 * interactive hit targets remain constant in screen pixels regardless of zoom level.
 */
export function getScreenScaledPadding(
  basePixels: number,
  scale: number,
  minScale = 0.4
): number {
  return basePixels / Math.max(minScale, scale);
}

/**
 * Hit-test helper: checks if a point in canvas space is within a rectangular bounding box,
 * with an optional expansion padding buffer.
 */
export function isPointInBounds(
  point: CanvasPoint,
  bounds: CanvasBounds,
  padding = 0
): boolean {
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  );
}

/**
 * Single authoritative source of truth: evaluates whether pointer movement from a start
 * position exceeds the click-vs-drag threshold.
 */
export function isDragGesture(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold = CLICK_VS_DRAG_THRESHOLD_PX
): boolean {
  return Math.hypot(currentX - startX, currentY - startY) > threshold;
}

/**
 * Milanote Pattern 2: checks if a canvas point falls within the protected corner
 * resize zone of a bounding box. Used to prevent edge anchor handles from swallowing
 * corner resize gestures.
 */
export function isPointInCornerZone(
  point: CanvasPoint,
  bounds: CanvasBounds,
  scale: number,
  cornerSizePx = CORNER_PRIORITY_ZONE_PX
): boolean {
  const cornerCanvasSize = cornerSizePx / Math.max(0.2, scale);

  const leftZone = point.x >= bounds.x - 4 && point.x <= bounds.x + cornerCanvasSize;
  const rightZone = point.x >= bounds.x + bounds.width - cornerCanvasSize && point.x <= bounds.x + bounds.width + 4;
  const topZone = point.y >= bounds.y - 4 && point.y <= bounds.y + cornerCanvasSize;
  const bottomZone = point.y >= bounds.y + bounds.height - cornerCanvasSize && point.y <= bounds.y + bounds.height + 4;

  const isTopLeft = leftZone && topZone;
  const isTopRight = rightZone && topZone;
  const isBottomLeft = leftZone && bottomZone;
  const isBottomRight = rightZone && bottomZone;

  return isTopLeft || isTopRight || isBottomLeft || isBottomRight;
}

/**
 * Computes canonical CanvasBounds from any object with x, y, width, and height.
 */
export function calculateItemBounds(
  item: { x: number; y: number; width: number; height: number }
): CanvasBounds {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  };
}

/**
 * Clamps a zoom scale within valid workspace limits.
 */
export function clampViewportScale(
  scale: number,
  minScale = MIN_CANVAS_SCALE,
  maxScale = MAX_CANVAS_SCALE
): number {
  return Math.min(maxScale, Math.max(minScale, scale));
}

/**
 * Calculates a new ViewportTransform when zooming toward a specific screen cursor position,
 * ensuring the canvas world coordinate under the cursor remains strictly anchored on screen.
 */
export function calculateCenteredZoom(
  currentViewport: ViewportTransform,
  pointerScreenX: number,
  pointerScreenY: number,
  targetScale: number,
  minScale = MIN_CANVAS_SCALE,
  maxScale = MAX_CANVAS_SCALE
): ViewportTransform {
  const clampedScale = clampViewportScale(targetScale, minScale, maxScale);

  // Canvas world point currently under the screen pointer
  const worldPointX = (pointerScreenX - currentViewport.x) / currentViewport.scale;
  const worldPointY = (pointerScreenY - currentViewport.y) / currentViewport.scale;

  // New stage position keeping world point at pointerScreen position
  const nextX = pointerScreenX - worldPointX * clampedScale;
  const nextY = pointerScreenY - worldPointY * clampedScale;

  return {
    x: Math.round(nextX * 100) / 100,
    y: Math.round(nextY * 100) / 100,
    scale: clampedScale,
  };
}

/**
 * Calculates a fitted ViewportTransform that centers and frames all items within the container.
 */
export function calculateZoomToFit(
  items: Array<{ x: number; y: number; width: number; height: number }>,
  containerWidth: number,
  containerHeight: number,
  padding = 64,
  minScale = MIN_CANVAS_SCALE,
  maxScale = 1.0
): ViewportTransform {
  if (items.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);

  const availableWidth = Math.max(10, containerWidth - padding * 2);
  const availableHeight = Math.max(10, containerHeight - padding * 2);

  const scale = clampViewportScale(
    Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
    minScale,
    maxScale
  );

  const centeredX = (containerWidth - contentWidth * scale) / 2 - minX * scale;
  const centeredY = (containerHeight - contentHeight * scale) / 2 - minY * scale;

  return {
    x: Math.round(centeredX),
    y: Math.round(centeredY),
    scale: Math.round(scale * 1000) / 1000,
  };
}
