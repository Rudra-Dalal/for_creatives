import type { AnchorPosition, AspectRatio, StoryboardPoint } from '../types';
import { calculateShotDimensions, DEFAULT_SHOT_WIDTH } from './storyboardGeometry';

/**
 * Standard cardinal anchors in clockwise order.
 */
export const CARDINAL_ANCHORS: readonly AnchorPosition[] = ['top', 'right', 'bottom', 'left'] as const;

/**
 * Default screen-space magnetic snapping proximity envelope in pixels.
 */
export const DEFAULT_SNAP_PROXIMITY_PX = 28;

/**
 * Minimal spatial attributes required from a shot card to compute anchor and connection geometry.
 */
export interface ShotSpatialInput {
  id?: string;
  x: number;
  y: number;
  width?: number;
  aspect_ratio?: AspectRatio | null;
}

/**
 * Result of a cubic Bézier sequence curve calculation.
 */
export interface SequenceBezierCurve {
  start: StoryboardPoint;
  controlPoint1: StoryboardPoint;
  controlPoint2: StoryboardPoint;
  end: StoryboardPoint;
  midpoint: StoryboardPoint;
  /** Flattened [x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1] for direct Konva.Arrow consumption */
  points: number[];
}

/**
 * Result of magnetic anchor snapping against candidate shot cards.
 */
export interface ClosestAnchorResult {
  shotId: string;
  anchor: AnchorPosition;
  point: StoryboardPoint;
  distance: number;
}

export interface FindClosestAnchorOptions {
  scale?: number;
  snapProximityPx?: number;
  excludeShotId?: string;
}

/**
 * Calculate exact world-space coordinates for a cardinal anchor on a Shot Card.
 * Reuses the authoritative calculateShotDimensions utility to guarantee 100% alignment
 * with ShotCardNode rendering across all aspect ratios.
 */
export function getShotAnchorPoint(
  shot: ShotSpatialInput,
  anchor: AnchorPosition
): StoryboardPoint {
  const ratio: AspectRatio = shot.aspect_ratio || '16:9';
  const { cardWidth, totalHeight } = calculateShotDimensions(ratio, shot.width || DEFAULT_SHOT_WIDTH);

  switch (anchor) {
    case 'top':
      return {
        x: Math.round(shot.x + cardWidth / 2),
        y: Math.round(shot.y),
      };
    case 'right':
      return {
        x: Math.round(shot.x + cardWidth),
        y: Math.round(shot.y + totalHeight / 2),
      };
    case 'bottom':
      return {
        x: Math.round(shot.x + cardWidth / 2),
        y: Math.round(shot.y + totalHeight),
      };
    case 'left':
      return {
        x: Math.round(shot.x),
        y: Math.round(shot.y + totalHeight / 2),
      };
  }
}

/**
 * Choose sensible source and target cardinal anchors based on relative spatial positioning.
 * Storyboard connections represent directional narrative sequence (Shot A -> Shot B).
 *
 * Rules:
 *  - Primarily horizontal (|dx| >= |dy|):
 *      dx >= 0 (target is right) => right -> left (standard cinematic progression)
 *      dx < 0  (target is left)  => left -> right
 *  - Primarily vertical (|dy| > |dx|):
 *      dy > 0 (target is below) => bottom -> top
 *      dy < 0 (target is above) => top -> bottom
 *  - Overlapping or identical centers: defaults deterministically to right -> left.
 */
export function getOptimalShotAnchors(
  source: ShotSpatialInput,
  target: ShotSpatialInput
): { fromAnchor: AnchorPosition; toAnchor: AnchorPosition } {
  const srcDims = calculateShotDimensions(source.aspect_ratio || '16:9', source.width || DEFAULT_SHOT_WIDTH);
  const tgtDims = calculateShotDimensions(target.aspect_ratio || '16:9', target.width || DEFAULT_SHOT_WIDTH);

  const srcCenter = {
    x: source.x + srcDims.cardWidth / 2,
    y: source.y + srcDims.totalHeight / 2,
  };
  const tgtCenter = {
    x: target.x + tgtDims.cardWidth / 2,
    y: target.y + tgtDims.totalHeight / 2,
  };

  const dx = tgtCenter.x - srcCenter.x;
  const dy = tgtCenter.y - srcCenter.y;

  // Overlapping or exact identical center: deterministic default
  if (dx === 0 && dy === 0) {
    return { fromAnchor: 'right', toAnchor: 'left' };
  }

  // Primarily horizontal relationship
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
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

/**
 * Pure geometry: calculates cubic Bézier control points, path points array,
 * and midpoint for a directed sequence arrow between two cardinal anchor points.
 *
 * Curvature is bounded between 24px and 180px and scales smoothly with distance,
 * preventing extreme looping or distortion for nearby shots.
 */
export function calculateSequenceBezierCurve(
  start: StoryboardPoint,
  end: StoryboardPoint,
  fromAnchor: AnchorPosition,
  toAnchor: AnchorPosition
): SequenceBezierCurve {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  // Smooth bounded curvature offset: 24px minimum, 180px maximum
  const offset = Math.max(24, Math.min(180, distance * 0.38));

  let cp1: StoryboardPoint;
  let cp2: StoryboardPoint;

  // Project control point 1 along the outward normal of the source anchor
  switch (fromAnchor) {
    case 'right':
      cp1 = { x: Math.round(start.x + offset), y: start.y };
      break;
    case 'left':
      cp1 = { x: Math.round(start.x - offset), y: start.y };
      break;
    case 'bottom':
      cp1 = { x: start.x, y: Math.round(start.y + offset) };
      break;
    case 'top':
      cp1 = { x: start.x, y: Math.round(start.y - offset) };
      break;
  }

  // Project control point 2 along the inward tangent approaching the target anchor
  switch (toAnchor) {
    case 'left':
      cp2 = { x: Math.round(end.x - offset), y: end.y };
      break;
    case 'right':
      cp2 = { x: Math.round(end.x + offset), y: end.y };
      break;
    case 'top':
      cp2 = { x: end.x, y: Math.round(end.y - offset) };
      break;
    case 'bottom':
      cp2 = { x: end.x, y: Math.round(end.y + offset) };
      break;
  }

  // Calculate cubic Bézier curve midpoint at t = 0.5:
  // B(0.5) = 0.125 * P0 + 0.375 * P1 + 0.375 * P2 + 0.125 * P3
  const midX = 0.125 * start.x + 0.375 * cp1.x + 0.375 * cp2.x + 0.125 * end.x;
  const midY = 0.125 * start.y + 0.375 * cp1.y + 0.375 * cp2.y + 0.125 * end.y;

  const midpoint: StoryboardPoint = {
    x: Math.round(midX),
    y: Math.round(midY),
  };

  return {
    start,
    controlPoint1: cp1,
    controlPoint2: cp2,
    end,
    midpoint,
    points: [start.x, start.y, cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y],
  };
}

/**
 * Given a world-space pointer, finds the closest valid anchor on candidate shots.
 * Converts screen-space snapping proximity (snapProximityPx) to world-space units via scale.
 * Excludes origin shot (excludeShotId) to prevent self-connection snapping.
 * Applies deterministic tie breaking (strictly closest distance).
 */
export function findClosestShotAnchor(
  pointer: StoryboardPoint,
  candidateShots: ShotSpatialInput[],
  options: FindClosestAnchorOptions = {}
): ClosestAnchorResult | null {
  const {
    scale = 1,
    snapProximityPx = DEFAULT_SNAP_PROXIMITY_PX,
    excludeShotId,
  } = options;

  const worldProximity = snapProximityPx / Math.max(0.15, scale);

  let bestResult: ClosestAnchorResult | null = null;
  let minDistance = Infinity;

  for (const shot of candidateShots) {
    if (excludeShotId && shot.id === excludeShotId) {
      continue;
    }

    const dims = calculateShotDimensions(shot.aspect_ratio || '16:9', shot.width || DEFAULT_SHOT_WIDTH);
    const cardWidth = dims.cardWidth;
    const totalHeight = dims.totalHeight;

    // Fast bounding box envelope rejection
    if (
      pointer.x < shot.x - worldProximity ||
      pointer.x > shot.x + cardWidth + worldProximity ||
      pointer.y < shot.y - worldProximity ||
      pointer.y > shot.y + totalHeight + worldProximity
    ) {
      continue;
    }

    for (const anchor of CARDINAL_ANCHORS) {
      const pt = getShotAnchorPoint(shot, anchor);
      const dist = Math.hypot(pointer.x - pt.x, pointer.y - pt.y);

      if (dist <= worldProximity) {
        if (dist < minDistance) {
          minDistance = dist;
          bestResult = {
            shotId: shot.id || '',
            anchor,
            point: pt,
            distance: dist,
          };
        }
      }
    }
  }

  return bestResult;
}

/**
 * Pure validity helper: detects self-connection attempt.
 */
export function isSelfConnection(fromShotId: string, toShotId: string): boolean {
  return !fromShotId || !toShotId ? false : fromShotId === toShotId;
}

/**
 * Pure validity helper: detects whether an active directed connection (from -> to) already exists.
 * Soft-deleted connections (where deleted_at is set) are ignored.
 */
export function isDuplicateConnection(
  existingConnections: Array<{ from_shot_id: string; to_shot_id: string; deleted_at?: string | null }>,
  fromShotId: string,
  toShotId: string
): boolean {
  return existingConnections.some(
    (conn) => !conn.deleted_at && conn.from_shot_id === fromShotId && conn.to_shot_id === toShotId
  );
}

/**
 * Pure validity helper: checks whether an active reverse connection (to -> from) already exists.
 * Storyboard connections represent directed sequence (A -> B != B -> A).
 */
export function isReverseConnection(
  existingConnections: Array<{ from_shot_id: string; to_shot_id: string; deleted_at?: string | null }>,
  fromShotId: string,
  toShotId: string
): boolean {
  return existingConnections.some(
    (conn) => !conn.deleted_at && conn.from_shot_id === toShotId && conn.to_shot_id === fromShotId
  );
}
