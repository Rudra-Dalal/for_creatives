import type { AnchorPosition, ResolvedConnection, MoodboardItem } from '../types';

export interface Point {
  x: number;
  y: number;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns the exact canvas coordinates for a cardinal anchor on a rectangular item.
 */
export function getAnchorPoint(bounds: RectBounds, anchor: AnchorPosition): Point {
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
 * Automatically chooses the pair of anchors that minimize wire crossing and visual clutter
 * between two bounding boxes.
 */
export function getOptimalAnchors(
  source: RectBounds,
  target: RectBounds
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

export interface BezierCurveData {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
  midpoint: Point;
  points: number[];
}

/**
 * Calculates cubic bezier curve points given start and end points with their respective anchor orientations.
 */
export function calculateBezierCurve(
  start: Point,
  end: Point,
  fromAnchor: AnchorPosition,
  toAnchor: AnchorPosition
): BezierCurveData {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  // Dynamic curvature offset based on distance
  const offset = Math.max(30, Math.min(180, distance * 0.4));

  let cp1: Point;
  let cp2: Point;

  switch (fromAnchor) {
    case 'right':
      cp1 = { x: start.x + offset, y: start.y };
      break;
    case 'left':
      cp1 = { x: start.x - offset, y: start.y };
      break;
    case 'bottom':
      cp1 = { x: start.x, y: start.y + offset };
      break;
    case 'top':
      cp1 = { x: start.x, y: start.y - offset };
      break;
  }

  switch (toAnchor) {
    case 'left':
      cp2 = { x: end.x - offset, y: end.y };
      break;
    case 'right':
      cp2 = { x: end.x + offset, y: end.y };
      break;
    case 'top':
      cp2 = { x: end.x, y: end.y - offset };
      break;
    case 'bottom':
      cp2 = { x: end.x, y: end.y + offset };
      break;
  }

  // Calculate cubic bezier midpoint at t = 0.5
  // B(t) = (1-t)^3 * P0 + 3(1-t)^2 * t * P1 + 3(1-t) * t^2 * P2 + t^3 * P3
  const t = 0.5;
  const t_ = 1 - t;
  const midX =
    t_ * t_ * t_ * start.x +
    3 * t_ * t_ * t * cp1.x +
    3 * t_ * t * t * cp2.x +
    t * t * t * end.x;
  const midY =
    t_ * t_ * t_ * start.y +
    3 * t_ * t_ * t * cp1.y +
    3 * t_ * t * t * cp2.y +
    t * t * t * end.y;

  return {
    start,
    cp1,
    cp2,
    end,
    midpoint: { x: Math.round(midX), y: Math.round(midY) },
    points: [start.x, start.y, cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y],
  };
}

/**
 * Resolves all active connections across moodboard items into a flat list of renderable connections,
 * filtering out any pointing to non-existent or deleted items.
 */
export function extractActiveConnections(items: MoodboardItem[]): ResolvedConnection[] {
  const itemMap = new Map<string, MoodboardItem>(items.map((i) => [i.id, i]));
  const resolved: ResolvedConnection[] = [];

  for (const item of items) {
    const rawConnections = (item.content as { connections?: unknown })?.connections;
    if (Array.isArray(rawConnections)) {
      for (const conn of rawConnections) {
        if (
          conn &&
          typeof conn === 'object' &&
          'id' in conn &&
          'targetId' in conn &&
          itemMap.has(conn.targetId) &&
          conn.targetId !== item.id
        ) {
          const targetItem = itemMap.get(conn.targetId)!;
          const optimal = getOptimalAnchors(item, targetItem);

          resolved.push({
            id: conn.id,
            fromId: item.id,
            targetId: conn.targetId,
            fromAnchor: conn.fromAnchor || optimal.fromAnchor,
            toAnchor: conn.toAnchor || optimal.toAnchor,
            label: conn.label,
          });
        }
      }
    }
  }

  return resolved;
}
