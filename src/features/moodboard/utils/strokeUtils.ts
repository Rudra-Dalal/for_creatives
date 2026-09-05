/**
 * Creative Workspace: Stroke / Drawing Utilities
 *
 * Provides point decimation / simplification (Douglas-Peucker + radial distance filter)
 * and bounding box normalization before persisting freehand canvas strokes.
 * Adheres strictly to storage discipline (eliminates raw pointer noise and bloat).
 */

import type { MoodboardItem, StrokeItemContent } from '../types';

export interface StrokeBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  relativePoints: number[];
}

interface Point {
  x: number;
  y: number;
}

/**
 * Calculates perpendicular distance from point P to line segment AB.
 */
function getPerpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq === 0) {
    const distSq = (p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y);
    return Math.sqrt(distSq);
  }

  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return num / Math.sqrt(lineLengthSq);
}

/**
 * Recursive Douglas-Peucker simplification on a Point array.
 */
function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = getPerpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);
    // Combine left and right without duplicating the shared pivot point
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

/**
 * Pre-filter to remove consecutive points closer than minDistance.
 */
function radialFilter(points: Point[], minDistance: number): Point[] {
  if (points.length <= 2) return points;

  const filtered: Point[] = [points[0]];
  const minDistSq = minDistance * minDistance;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = points[i];
    const distSq = (curr.x - prev.x) * (curr.x - prev.x) + (curr.y - prev.y) * (curr.y - prev.y);

    if (distSq >= minDistSq) {
      filtered.push(curr);
    }
  }

  // Always retain the terminal point
  filtered.push(points[points.length - 1]);
  return filtered;
}

/**
 * Simplifies a flat array of numbers `[x0, y0, x1, y1, ...]` using
 * a radial filter followed by Douglas-Peucker simplification.
 *
 * @param rawPoints Flat array of coordinate pairs [x0, y0, x1, y1, ...]
 * @param tolerance Douglas-Peucker epsilon tolerance in canvas pixels (default: 1.5)
 * @returns Simplified flat array of coordinate pairs
 */
export function simplifyPoints(rawPoints: number[], tolerance = 1.5): number[] {
  if (!rawPoints || rawPoints.length < 4) {
    // Single point / click or empty
    if (rawPoints.length === 2) {
      // Ensure single-click tap creates a minimal 0.1px segment so round lineCap renders as a dot
      return [rawPoints[0], rawPoints[1], rawPoints[0] + 0.1, rawPoints[1] + 0.1];
    }
    return rawPoints;
  }

  // Convert flat array to Point array
  const points: Point[] = [];
  for (let i = 0; i < rawPoints.length; i += 2) {
    points.push({ x: rawPoints[i], y: rawPoints[i + 1] });
  }

  // Step 1: Radial distance pre-filter (drop redundant micro-jitters < 1.0px)
  const preFiltered = radialFilter(points, 1.0);

  // Step 2: Douglas-Peucker reduction
  const simplified = douglasPeucker(preFiltered, tolerance);

  // Convert back to flat array
  const result: number[] = [];
  for (const pt of simplified) {
    result.push(pt.x, pt.y);
  }

  return result;
}

/**
 * Calculates bounding box and normalizes points relative to the top-left (minX, minY)
 * of the bounding box. Also rounds coordinates to 1 decimal place to minimize jsonb storage size.
 *
 * @param points Canvas-space flat array of points [x0, y0, x1, y1, ...]
 * @returns StrokeBoundingBox with position, dimensions, and normalized relative points
 */
export function normalizeStrokePoints(points: number[]): StrokeBoundingBox {
  if (points.length < 2) {
    return { x: 0, y: 0, width: 20, height: 20, relativePoints: [0, 0] };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Ensure non-zero bounding dimensions
  const width = Math.max(12, maxX - minX);
  const height = Math.max(12, maxY - minY);

  // Normalize points relative to minX, minY and round to 1 decimal place
  const relativePoints: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const relX = Math.round((points[i] - minX) * 10) / 10;
    const relY = Math.round((points[i + 1] - minY) * 10) / 10;
    relativePoints.push(relX, relY);
  }

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(width),
    height: Math.round(height),
    relativePoints,
  };
}

/**
 * Calculates perpendicular or clamped distance from point (px, py) to line segment (x1, y1)-(x2, y2).
 */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Checks if a point (canvasX, canvasY) intersects an active stroke.
 * Strictly verifies the item is non-deleted, of type 'stroke', and within hit radius.
 */
export function isPointIntersectingStroke(
  canvasX: number,
  canvasY: number,
  item: MoodboardItem,
  hitRadius = 14
): boolean {
  if (item.type !== 'stroke' || item.deleted_at) {
    return false;
  }

  const content = (item.content as StrokeItemContent) || {};
  const points = content.points || [];
  if (points.length < 2) return false;

  const strokeWidth = content.strokeWidth || 4;
  const effectiveRadius = Math.max(hitRadius, strokeWidth / 2 + 8);

  // Quick bounding box check with padding
  const minX = item.x - effectiveRadius;
  const maxX = item.x + item.width + effectiveRadius;
  const minY = item.y - effectiveRadius;
  const maxY = item.y + item.height + effectiveRadius;

  if (canvasX < minX || canvasX > maxX || canvasY < minY || canvasY > maxY) {
    return false;
  }

  // Segment distance checks
  for (let i = 0; i < points.length - 2; i += 2) {
    const x1 = item.x + points[i];
    const y1 = item.y + points[i + 1];
    const x2 = item.x + points[i + 2];
    const y2 = item.y + points[i + 3];

    const dist = distanceToSegment(canvasX, canvasY, x1, y1, x2, y2);
    if (dist <= effectiveRadius) {
      return true;
    }
  }

  // Single-point tap or closed end
  if (points.length === 2) {
    const dist = Math.hypot(canvasX - (item.x + points[0]), canvasY - (item.y + points[1]));
    if (dist <= effectiveRadius) return true;
  }

  return false;
}

/**
 * Checks if a movement segment from (x1, y1) to (x2, y2) intersects an active stroke.
 * Samples along the trajectory to ensure fast eraser drags never miss strokes.
 */
export function isPathIntersectingStroke(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  item: MoodboardItem,
  hitRadius = 14
): boolean {
  if (item.type !== 'stroke' || item.deleted_at) {
    return false;
  }

  const dist = Math.hypot(toX - fromX, toY - fromY);
  const steps = Math.max(1, Math.ceil(dist / 8)); // sample every 8px
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = fromX + (toX - fromX) * t;
    const py = fromY + (toY - fromY) * t;
    if (isPointIntersectingStroke(px, py, item, hitRadius)) {
      return true;
    }
  }
  return false;
}

