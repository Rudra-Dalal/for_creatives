/**
 * Creative Workspace: Stroke Slicing Utilities
 *
 * Provides polyline-circle intersection math to support partial pen stroke erasing.
 * Splitting a stroke splits it into surviving continuous sub-chains outside the eraser radius.
 * Preserves Douglas-Peucker simplification and bounding box normalization.
 */

import { simplifyPoints, normalizeStrokePoints, StrokeBoundingBox } from './strokeUtils';

export interface SliceResult {
  /** Canvas-space points [x0, y0, x1, y1, ...] for each surviving sub-stroke. */
  survivingSegments: number[][];
}

/**
 * Calculates total arc length of a flat polyline [x0, y0, x1, y1, ...].
 */
export function calculatePolylineLength(points: number[]): number {
  if (!points || points.length < 4) return 0;
  let len = 0;
  for (let i = 0; i < points.length - 2; i += 2) {
    len += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
  }
  return len;
}

/**
 * Slices an absolute canvas-space polyline with a circle (eraser) defined by (cx, cy, radius).
 * Returns an array of surviving sub-polylines in absolute canvas coordinates.
 *
 * @param absolutePoints Flat array of canvas-space coordinates [x0, y0, x1, y1, ...]
 * @param cx Center X of the eraser circle in canvas space
 * @param cy Center Y of the eraser circle in canvas space
 * @param radius Radius of the eraser circle in canvas space
 * @param minSegmentLength Minimum surviving length in px (defaults to 2.0 to discard micro-stubs)
 */
export function slicePolylineWithCircle(
  absolutePoints: number[],
  cx: number,
  cy: number,
  radius: number,
  minSegmentLength = 2.0
): number[][] {
  if (!absolutePoints || absolutePoints.length < 2) {
    return [];
  }

  // Single-point dot
  if (absolutePoints.length === 2) {
    const distSq = (absolutePoints[0] - cx) ** 2 + (absolutePoints[1] - cy) ** 2;
    if (distSq <= radius ** 2) {
      return [];
    }
    return [absolutePoints];
  }

  const rSq = radius * radius;
  const isInside = (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= rSq;

  const chunks: number[][] = [];
  let currentChunk: number[] = [];

  const startInside = isInside(absolutePoints[0], absolutePoints[1]);
  if (!startInside) {
    currentChunk.push(absolutePoints[0], absolutePoints[1]);
  }

  for (let i = 0; i < absolutePoints.length - 2; i += 2) {
    const ax = absolutePoints[i];
    const ay = absolutePoints[i + 1];
    const bx = absolutePoints[i + 2];
    const by = absolutePoints[i + 3];

    const insideA = isInside(ax, ay);
    const insideB = isInside(bx, by);

    const dx = bx - ax;
    const dy = by - ay;
    const segLenSq = dx * dx + dy * dy;

    if (segLenSq === 0) {
      continue;
    }

    // Solve quadratic || A + t*D - C ||^2 = R^2
    const deltax = ax - cx;
    const deltay = ay - cy;

    const a = segLenSq;
    const b = 2 * (deltax * dx + deltay * dy);
    const c = deltax * deltax + deltay * deltay - rSq;
    const disc = b * b - 4 * a * c;

    if (insideA && insideB) {
      // Entire segment is inside circle — finish any current chunk
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    } else if (!insideA && insideB) {
      // Entering circle from outside: root t in [0, 1]
      if (disc > 0) {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);
        const t = t1 >= -1e-6 && t1 <= 1 + 1e-6 ? t1 : t2;
        const clampedT = Math.max(0, Math.min(1, t));
        const qx = ax + clampedT * dx;
        const qy = ay + clampedT * dy;
        currentChunk.push(qx, qy);
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    } else if (insideA && !insideB) {
      // Exiting circle to outside: root t in [0, 1]
      let qx = bx;
      let qy = by;
      if (disc > 0) {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);
        const t = t2 >= -1e-6 && t2 <= 1 + 1e-6 ? t2 : t1;
        const clampedT = Math.max(0, Math.min(1, t));
        qx = ax + clampedT * dx;
        qy = ay + clampedT * dy;
      }
      currentChunk = [qx, qy, bx, by];
    } else {
      // Both ends outside: check if segment cuts through circle in between
      let didIntersect = false;
      if (disc > 0) {
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);

        if (t1 > 1e-4 && t2 < 1 - 1e-4) {
          // Circle punches a hole through middle of segment
          didIntersect = true;
          const q1x = ax + t1 * dx;
          const q1y = ay + t1 * dy;
          const q2x = ax + t2 * dx;
          const q2y = ay + t2 * dy;

          currentChunk.push(q1x, q1y);
          chunks.push(currentChunk);
          currentChunk = [q2x, q2y, bx, by];
        }
      }

      if (!didIntersect) {
        currentChunk.push(bx, by);
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Filter out any micro-stubs shorter than minSegmentLength unless it was a point
  const result: number[][] = [];
  for (const chunk of chunks) {
    if (chunk.length < 4) {
      if (chunk.length === 2 && minSegmentLength <= 0) {
        result.push(chunk);
      }
      continue;
    }
    const len = calculatePolylineLength(chunk);
    if (len >= minSegmentLength) {
      result.push(chunk);
    }
  }

  return result;
}

/**
 * Slices an entire stroke item with an eraser circle at (cx, cy) with radius.
 * Converts from item-relative space to canvas space, slices, simplifies, and normalizes each surviving piece.
 */
export function sliceStrokeItem(
  itemX: number,
  itemY: number,
  relativePoints: number[],
  cx: number,
  cy: number,
  radius: number
): StrokeBoundingBox[] {
  if (!relativePoints || relativePoints.length < 2) return [];

  // Convert to absolute canvas coordinates
  const absPoints: number[] = [];
  for (let i = 0; i < relativePoints.length; i += 2) {
    absPoints.push(itemX + relativePoints[i], itemY + relativePoints[i + 1]);
  }

  const surviving = slicePolylineWithCircle(absPoints, cx, cy, radius);

  // Simplify and normalize each piece back into local item coordinates
  return surviving.map((rawSegment) => {
    const simplified = simplifyPoints(rawSegment, 1.0);
    return normalizeStrokePoints(simplified);
  });
}
