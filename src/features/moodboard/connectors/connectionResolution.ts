import type { ResolvedConnection, MoodboardItem } from '../types';
import { getOptimalAnchors } from './geometry/anchorGeometry';

/**
 * Resolves all active connections across moodboard items into a flat list of renderable connections,
 * filtering out any pointing to non-existent or deleted items, self-connections, or deleted items.
 *
 * Separated from pure bezier geometry into connection-resolution domain.
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
