import type { MoodboardItem } from '../types';
import { extractActiveConnections } from './geometry/bezierGeometry';

/**
 * Traverses all active connections on the moodboard bidirectionally to find
 * all Reference item IDs (`reference_id`) connected to a specified Idea item.
 *
 * This preserves the core product requirement:
 *   REFERENCE <-> CREATIVE DIRECTION NOTE
 *
 * When an Idea is promoted to a Creative Direction Note, all linked references
 * are automatically populated into `direction_reference_links`.
 */
export function getConnectedReferenceIdsForIdea(
  ideaItemId: string,
  items: MoodboardItem[]
): string[] {
  if (!ideaItemId || !items || items.length === 0) return [];

  const activeConns = extractActiveConnections(items);
  const connectedItemIds = new Set<string>();

  for (const conn of activeConns) {
    if (conn.fromId === ideaItemId) {
      connectedItemIds.add(conn.targetId);
    } else if (conn.targetId === ideaItemId) {
      connectedItemIds.add(conn.fromId);
    }
  }

  const referenceIds: string[] = [];
  for (const id of connectedItemIds) {
    const item = items.find((i) => i.id === id);
    if (item && !item.deleted_at && item.type === 'reference' && item.reference_id) {
      referenceIds.push(item.reference_id);
    }
  }

  return referenceIds;
}
