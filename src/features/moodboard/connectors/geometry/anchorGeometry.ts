import type { AnchorPosition } from '../../types';
import type { CanvasPoint, CanvasBounds } from '../../coordinates/geometryTypes';
import { CORNER_PRIORITY_ZONE_PX } from '../../coordinates/constants';

/**
 * Returns the exact canvas world coordinates for a cardinal anchor on a rectangular item.
 * Anchors are strictly located at edge centers:
 *  - top:    (bounds.x + bounds.width / 2, bounds.y)
 *  - right:  (bounds.x + bounds.width, bounds.y + bounds.height / 2)
 *  - bottom: (bounds.x + bounds.width / 2, bounds.y + bounds.height)
 *  - left:   (bounds.x, bounds.y + bounds.height / 2)
 */
export function getAnchorPoint(bounds: CanvasBounds, anchor: AnchorPosition): CanvasPoint {
  switch (anchor) {
    case 'top':
      return { x: bounds.x + bounds.width / 2, y: bounds.y };
    case 'right':
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 };
    case 'bottom':
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height };
    case 'left':
      return { x: bounds.x, y: bounds.y + bounds.height / 2 };
  }
}

/**
 * All four cardinal anchor positions in standard clockwise order.
 */
export const CARDINAL_ANCHORS: readonly AnchorPosition[] = ['top', 'right', 'bottom', 'left'] as const;

/**
 * Checks whether a given canvas point falls within the corner protection zone
 * of any of the 4 corners of a rectangular item.
 *
 * In the corner protection zone (default 20px), Transformer corner resize handles
 * take absolute hit priority over connector initiation or attachment.
 */
export function isPointInCornerProtectionZone(
  point: CanvasPoint,
  bounds: CanvasBounds,
  zonePx: number = CORNER_PRIORITY_ZONE_PX
): boolean {
  const corners: CanvasPoint[] = [
    { x: bounds.x, y: bounds.y },                                    // Top-Left
    { x: bounds.x + bounds.width, y: bounds.y },                     // Top-Right
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },      // Bottom-Right
    { x: bounds.x, y: bounds.y + bounds.height },                     // Bottom-Left
  ];

  for (const corner of corners) {
    const dist = Math.hypot(point.x - corner.x, point.y - corner.y);
    if (dist <= zonePx) {
      return true;
    }
  }

  return false;
}

export interface ClosestAnchorResult {
  anchor: AnchorPosition;
  point: CanvasPoint;
  distance: number;
}

/**
 * Finds the closest cardinal anchor on an item's bounding box to a target pointer point.
 * Used for magnetic cardinal edge snapping during connector dragging.
 */
export function findClosestCardinalAnchor(
  pointer: CanvasPoint,
  bounds: CanvasBounds
): ClosestAnchorResult {
  let bestAnchor: AnchorPosition = 'left';
  let bestPoint: CanvasPoint = getAnchorPoint(bounds, 'left');
  let minDistance = Infinity;

  for (const anchor of CARDINAL_ANCHORS) {
    const pt = getAnchorPoint(bounds, anchor);
    const dist = Math.hypot(pointer.x - pt.x, pointer.y - pt.y);
    if (dist < minDistance) {
      minDistance = dist;
      bestAnchor = anchor;
      bestPoint = pt;
    }
  }

  return {
    anchor: bestAnchor,
    point: bestPoint,
    distance: minDistance,
  };
}

/**
 * Automatically chooses the pair of anchors that minimizes wire crossing and visual clutter
 * between two rectangular items.
 */
export function getOptimalAnchors(
  source: CanvasBounds,
  target: CanvasBounds
): { fromAnchor: AnchorPosition; toAnchor: AnchorPosition } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // Primarily horizontal relationship
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) {
      return { fromAnchor: 'right', toAnchor: 'left' };
    } else {
      return { fromAnchor: 'left', toAnchor: 'right' };
    }
  }

  // Primarily vertical relationship
  if (dy > 0) {
    return { fromAnchor: 'bottom', toAnchor: 'top' };
  } else {
    return { fromAnchor: 'top', toAnchor: 'bottom' };
  }
}
