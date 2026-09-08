import type { AnchorPosition, ResolvedConnection, MoodboardItem } from '../../types';
import type { CanvasPoint } from '../../coordinates/geometryTypes';
import { getOptimalAnchors } from './anchorGeometry';

export interface BezierCurveData {
  start: CanvasPoint;
  cp1: CanvasPoint;
  cp2: CanvasPoint;
  end: CanvasPoint;
  midpoint: CanvasPoint;
  points: number[];
}

/**
 * Calculates cubic Bezier midpoint at parameter t (default: 0.5).
 * B(t) = (1-t)^3 * P0 + 3(1-t)^2 * t * P1 + 3(1-t) * t^2 * P2 + t^3 * P3
 */
export function calculateBezierMidpoint(
  start: CanvasPoint,
  cp1: CanvasPoint,
  cp2: CanvasPoint,
  end: CanvasPoint,
  t = 0.5
): CanvasPoint {
  const t_ = 1 - t;
  const t_3 = t_ * t_ * t_;
  const t_2_t = 3 * t_ * t_ * t;
  const t_t2 = 3 * t_ * t * t;
  const t3 = t * t * t;

  const midX = t_3 * start.x + t_2_t * cp1.x + t_t2 * cp2.x + t3 * end.x;
  const midY = t_3 * start.y + t_2_t * cp1.y + t_t2 * cp2.y + t3 * end.y;

  return {
    x: Math.round(midX),
    y: Math.round(midY),
  };
}

/**
 * Pure geometry function: calculates cubic Bezier control points, curve path points,
 * and label midpoint for connecting two cardinal anchor points.
 */
export function calculateBezierCurve(
  start: CanvasPoint,
  end: CanvasPoint,
  fromAnchor: AnchorPosition,
  toAnchor: AnchorPosition
): BezierCurveData {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  // Dynamic curvature offset based on distance (clamped between 30px and 180px)
  const offset = Math.max(30, Math.min(180, distance * 0.4));

  let cp1: CanvasPoint;
  let cp2: CanvasPoint;

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

  const midpoint = calculateBezierMidpoint(start, cp1, cp2, end, 0.5);

  return {
    start,
    cp1,
    cp2,
    end,
    midpoint,
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
    if (item.deleted_at) continue;
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
          if (targetItem.deleted_at) continue;

          const optimal = getOptimalAnchors(
            { x: item.x, y: item.y, width: item.width, height: item.height },
            { x: targetItem.x, y: targetItem.y, width: targetItem.width, height: targetItem.height }
          );

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
