import type { StoryboardStroke } from '../types';

/**
 * Minimal interface representing the geometric fields of a StoryboardStroke.
 * Allows pure geometry testing with mock objects as well as full StoryboardStroke rows.
 */
export type StrokeGeometryLike = Pick<StoryboardStroke, 'stroke_width'> & {
  points: unknown;
  deleted_at?: string | null;
};

interface Point2D {
  x: number;
  y: number;
}

/**
 * Rounds a number to 1 decimal place to minimize JSON storage footprint.
 * Safely eliminates -0.
 */
function round1(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Calculates perpendicular distance from point P to line segment AB.
 * If A and B are identical, calculates distance to point A.
 */
function perpendicularDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);

  if (len === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  // Standard line equation distance: |(y2-y1)x0 - (x2-x1)y0 + x2*y1 - y2*x1| / len
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/**
 * Recursive Douglas-Peucker line decimation algorithm.
 */
function douglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }

  if (maxDistance > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIndex), epsilon);
    // Combine preserving split node without duplication
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

/**
 * Simplifies a flat array of world-coordinate points [x0, y0, x1, y1, ...]
 * using a 1.0 unit radial pre-filter followed by Douglas-Peucker decimation.
 *
 * @param rawPoints Flat array of coordinate numbers
 * @param tolerance Douglas-Peucker epsilon in Storyboard world units (default 1.5)
 * @returns Simplified flat array of coordinate numbers rounded to 1 decimal place
 */
export function simplifyStrokePoints(
  rawPoints: number[],
  tolerance = 1.5
): number[] {
  if (!rawPoints || rawPoints.length === 0) {
    return [];
  }

  // Ensure even number of coordinates
  const validLength = rawPoints.length - (rawPoints.length % 2);
  if (validLength < 2) {
    return [];
  }

  // Single point tap: [x, y] -> create a minimal segment [x, y, x + 0.1, y + 0.1]
  // so Konva Line renders a circular dot with lineCap='round'
  if (validLength === 2) {
    const x = round1(rawPoints[0]);
    const y = round1(rawPoints[1]);
    return [x, y, round1(x + 0.1), round1(y + 0.1)];
  }

  // Parse into 2D points
  const points: Point2D[] = [];
  for (let i = 0; i < validLength; i += 2) {
    const x = rawPoints[i];
    const y = rawPoints[i + 1];
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }

  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    const p = points[0];
    const x = round1(p.x);
    const y = round1(p.y);
    return [x, y, round1(x + 0.1), round1(y + 0.1)];
  }

  // 1. Radial pre-filter (threshold = 1.0 world unit)
  const radialThresholdSq = 1.0 * 1.0;
  const filtered: Point2D[] = [points[0]];
  let lastKept = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    const dx = pt.x - lastKept.x;
    const dy = pt.y - lastKept.y;
    if (dx * dx + dy * dy >= radialThresholdSq) {
      filtered.push(pt);
      lastKept = pt;
    }
  }

  // Always preserve the exact final endpoint
  filtered.push(points[points.length - 1]);

  // 2. Douglas-Peucker simplification
  const simplified = douglasPeucker(filtered, Math.max(0, tolerance));

  // 3. Format into flat array with 1-decimal rounding
  const result: number[] = [];
  for (let i = 0; i < simplified.length; i++) {
    result.push(round1(simplified[i].x), round1(simplified[i].y));
  }

  // If simplified down to a single point, expand to minimal dot segment
  if (result.length === 2) {
    const x = result[0];
    const y = result[1];
    return [x, y, round1(x + 0.1), round1(y + 0.1)];
  }

  return result;
}

/**
 * Safely extracts a flat number array from a stroke's points field.
 */
function extractPointsArray(points: unknown): number[] | null {
  let parsed = points;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed) || parsed.length < 4 || parsed.length % 2 !== 0) {
    return null;
  }

  for (let i = 0; i < parsed.length; i++) {
    if (typeof parsed[i] !== 'number' || !Number.isFinite(parsed[i])) {
      return null;
    }
  }

  return parsed as number[];
}

/**
 * Determines whether a world-coordinate point hits a stroke.
 *
 * Implements whole-stroke hit testing:
 * 1. Immediately rejects soft-deleted or invalid strokes.
 * 2. Performs AABB bounding box quick rejection padded by effective hit radius.
 * 3. Evaluates minimum perpendicular/projection distance across every segment.
 *
 * Effective radius: max(hitRadius, stroke.stroke_width / 2 + 8)
 *
 * @param canvasX Point X in Storyboard world coordinates
 * @param canvasY Point Y in Storyboard world coordinates
 * @param stroke Target StoryboardStroke or compatible object
 * @param hitRadius Base eraser hit radius in world units (default: 14)
 */
export function isPointHittingStroke(
  canvasX: number,
  canvasY: number,
  stroke: StrokeGeometryLike,
  hitRadius = 14
): boolean {
  // Reject soft-deleted stroke immediately
  if (stroke.deleted_at != null) {
    return false;
  }

  if (!Number.isFinite(canvasX) || !Number.isFinite(canvasY)) {
    return false;
  }

  const rawPoints = extractPointsArray(stroke.points);
  if (!rawPoints) {
    return false;
  }

  const strokeWidth =
    typeof stroke.stroke_width === 'number' && Number.isFinite(stroke.stroke_width)
      ? Math.max(0, stroke.stroke_width)
      : 2;

  const effectiveRadius = Math.max(hitRadius, strokeWidth / 2 + 8);
  const effectiveRadiusSq = effectiveRadius * effectiveRadius;

  // AABB bounding box calculation
  let minX = rawPoints[0];
  let maxX = rawPoints[0];
  let minY = rawPoints[1];
  let maxY = rawPoints[1];

  for (let i = 2; i < rawPoints.length; i += 2) {
    const x = rawPoints[i];
    const y = rawPoints[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Quick AABB rejection
  if (
    canvasX < minX - effectiveRadius ||
    canvasX > maxX + effectiveRadius ||
    canvasY < minY - effectiveRadius ||
    canvasY > maxY + effectiveRadius
  ) {
    return false;
  }

  // Point-to-segment distance check
  for (let i = 0; i < rawPoints.length - 2; i += 2) {
    const x1 = rawPoints[i];
    const y1 = rawPoints[i + 1];
    const x2 = rawPoints[i + 2];
    const y2 = rawPoints[i + 3];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const segLenSq = dx * dx + dy * dy;

    let distSq = 0;
    if (segLenSq === 0) {
      const px = canvasX - x1;
      const py = canvasY - y1;
      distSq = px * px + py * py;
    } else {
      const t = Math.max(
        0,
        Math.min(1, ((canvasX - x1) * dx + (canvasY - y1) * dy) / segLenSq)
      );
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const px = canvasX - projX;
      const py = canvasY - projY;
      distSq = px * px + py * py;
    }

    if (distSq <= effectiveRadiusSq) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether a swept eraser path between (fromX, fromY) and (toX, toY)
 * intersects a stroke.
 *
 * Samples the path vector every ~8 world units to guarantee fast eraser sweeps
 * do not jump over thin strokes.
 *
 * @param fromX Starting X coordinate in world units
 * @param fromY Starting Y coordinate in world units
 * @param toX Ending X coordinate in world units
 * @param toY Ending Y coordinate in world units
 * @param stroke Target StoryboardStroke or compatible object
 * @param hitRadius Base eraser hit radius in world units (default: 14)
 */
export function isPathHittingStroke(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  stroke: StrokeGeometryLike,
  hitRadius = 14
): boolean {
  if (
    !Number.isFinite(fromX) ||
    !Number.isFinite(fromY) ||
    !Number.isFinite(toX) ||
    !Number.isFinite(toY)
  ) {
    return false;
  }

  if (stroke.deleted_at != null) {
    return false;
  }

  // Check start endpoint
  if (isPointHittingStroke(fromX, fromY, stroke, hitRadius)) {
    return true;
  }

  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);

  if (dist === 0) {
    return false;
  }

  // Check end endpoint
  if (isPointHittingStroke(toX, toY, stroke, hitRadius)) {
    return true;
  }

  // Sample along path every ~8 world units
  const stepSize = 8;
  const steps = Math.ceil(dist / stepSize);

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sampleX = fromX + t * dx;
    const sampleY = fromY + t * dy;
    if (isPointHittingStroke(sampleX, sampleY, stroke, hitRadius)) {
      return true;
    }
  }

  return false;
}
