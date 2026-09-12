import { describe, it, expect } from 'vitest';
import {
  calculateSmartArrange,
  calculateAutoArrange,
  calculateAlignment,
  calculateDistribution,
} from '../layoutUtils';
import type { MoodboardItem } from '../../types';

function createMockItem(
  id: string,
  type: MoodboardItem['type'],
  x: number,
  y: number,
  width: number,
  height: number,
  connections?: Array<{ id: string; targetId: string; label?: string }>
): MoodboardItem {
  return {
    id,
    project_id: 'test-project',
    reference_id: null,
    type,
    x,
    y,
    width,
    height,
    z_index: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    content: {
      connections: connections || [],
    } as unknown as MoodboardItem['content'],
  };
}

describe('layoutUtils - Smart Arrange Engine', () => {
  describe('Basic Edge Cases', () => {
    it('returns empty array when items array is empty', () => {
      expect(calculateSmartArrange([])).toEqual([]);
    });

    it('returns empty array when all items are deleted', () => {
      const deletedItem = createMockItem('item-1', 'reference', 100, 100, 200, 150);
      deletedItem.deleted_at = '2026-01-02T00:00:00Z';
      expect(calculateSmartArrange([deletedItem])).toEqual([]);
    });

    it('returns single position for single item', () => {
      const item = createMockItem('item-1', 'idea', 150, 200, 240, 160);
      const updates = calculateSmartArrange([item]);
      expect(updates).toHaveLength(1);
      expect(updates[0].id).toBe('item-1');
      expect(updates[0].x).toBe(150);
      expect(updates[0].y).toBe(200);
    });
  });

  describe('Directional Flow & Connected Clusters', () => {
    it('arranges A -> B -> C into a directional left-to-right flow with zero collisions', () => {
      // Reference A -> Idea B -> Color C
      const refA = createMockItem('ref-a', 'reference', 500, 500, 200, 150, [
        { id: 'c1', targetId: 'idea-b' },
      ]);
      const ideaB = createMockItem('idea-b', 'idea', 100, 100, 220, 160, [
        { id: 'c2', targetId: 'color-c' },
      ]);
      const colorC = createMockItem('color-c', 'color', 800, 200, 140, 140);

      const updates = calculateSmartArrange([refA, ideaB, colorC]);
      expect(updates).toHaveLength(3);

      const updateMap = new Map(updates.map((u) => [u.id, u]));
      const posA = updateMap.get('ref-a')!;
      const posB = updateMap.get('idea-b')!;
      const posC = updateMap.get('color-c')!;

      // Directional left-to-right order
      expect(posA.x).toBeLessThan(posB.x);
      expect(posB.x).toBeLessThan(posC.x);

      // Verify no overlaps between bounding boxes
      expect(posA.x + refA.width).toBeLessThanOrEqual(posB.x);
      expect(posB.x + ideaB.width).toBeLessThanOrEqual(posC.x);
    });

    it('centers single hub Idea B vertically when two references A and D point into B', () => {
      // Ref A -> Idea B
      // Ref D -> Idea B
      const refA = createMockItem('ref-a', 'reference', 0, 0, 200, 100, [
        { id: 'c1', targetId: 'idea-b' },
      ]);
      const refD = createMockItem('ref-d', 'reference', 0, 300, 200, 100, [
        { id: 'c2', targetId: 'idea-b' },
      ]);
      const ideaB = createMockItem('idea-b', 'idea', 500, 100, 200, 100);

      const updates = calculateSmartArrange([refA, refD, ideaB]);
      const updateMap = new Map(updates.map((u) => [u.id, u]));

      const posA = updateMap.get('ref-a')!;
      const posD = updateMap.get('ref-d')!;
      const posB = updateMap.get('idea-b')!;

      // Sources A and D are on left
      expect(posA.x).toBeLessThan(posB.x);
      expect(posD.x).toBeLessThan(posB.x);

      // A and D stacked vertically on same X
      expect(posA.x).toBe(posD.x);
      expect(posD.y).toBeGreaterThan(posA.y + refA.height);

      // Hub B is vertically centered between the span of A and D
      const sourcesCenterY = (posA.y + (posD.y + refD.height)) / 2;
      const hubCenterY = posB.y + ideaB.height / 2;
      expect(Math.abs(sourcesCenterY - hubCenterY)).toBeLessThanOrEqual(5);
    });
  });

  describe('Evidence-Based Hierarchy', () => {
    it('prioritizes high-degree nodes as hubs regardless of item type', () => {
      // A color swatch with 2 incoming and 1 outgoing connections acts as a hub
      const ref1 = createMockItem('ref-1', 'reference', 0, 0, 200, 150, [
        { id: 'c1', targetId: 'color-hub' },
      ]);
      const ref2 = createMockItem('ref-2', 'reference', 0, 200, 200, 150, [
        { id: 'c2', targetId: 'color-hub' },
      ]);
      const colorHub = createMockItem('color-hub', 'color', 300, 100, 140, 140, [
        { id: 'c3', targetId: 'text-sink' },
      ]);
      const textSink = createMockItem('text-sink', 'text', 600, 100, 180, 120);

      const updates = calculateSmartArrange([ref1, ref2, colorHub, textSink]);
      const updateMap = new Map(updates.map((u) => [u.id, u]));

      const posRef1 = updateMap.get('ref-1')!;
      const posRef2 = updateMap.get('ref-2')!;
      const posHub = updateMap.get('color-hub')!;
      const posSink = updateMap.get('text-sink')!;

      // Color hub is positioned downstream of inputs and upstream of output
      expect(posRef1.x).toBeLessThan(posHub.x);
      expect(posRef2.x).toBeLessThan(posHub.x);
      expect(posHub.x).toBeLessThan(posSink.x);
    });
  });

  describe('Collision Avoidance & Spatial Clustering', () => {
    it('ensures zero overlap between any items in an unconnected proximity cluster', () => {
      const items = [
        createMockItem('item-1', 'reference', 100, 100, 200, 150),
        createMockItem('item-2', 'reference', 120, 120, 200, 150),
        createMockItem('item-3', 'image', 110, 110, 220, 160),
        createMockItem('item-4', 'idea', 130, 130, 240, 160),
      ];

      const updates = calculateSmartArrange(items);
      expect(updates).toHaveLength(4);

      // Check all pairs for overlap
      const updateMap = new Map(updates.map((u) => [u.id, u]));
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const posA = updateMap.get(a.id)!;
          const posB = updateMap.get(b.id)!;

          const overlapX =
            posA.x < posB.x + b.width && posA.x + a.width > posB.x;
          const overlapY =
            posA.y < posB.y + b.height && posA.y + a.height > posB.y;

          expect(overlapX && overlapY).toBe(false);
        }
      }
    });

    it('separates distinct clusters with generous inter-cluster clearance', () => {
      // Cluster 1: connected A -> B
      const itemA = createMockItem('item-a', 'idea', 100, 100, 200, 150, [
        { id: 'c1', targetId: 'item-b' },
      ]);
      const itemB = createMockItem('item-b', 'color', 350, 100, 140, 140);

      // Cluster 2: unconnected C and D placed 600px away
      const itemC = createMockItem('item-c', 'reference', 800, 800, 200, 150);
      const itemD = createMockItem('item-d', 'reference', 850, 850, 200, 150);

      const updates = calculateSmartArrange([itemA, itemB, itemC, itemD]);
      const updateMap = new Map(updates.map((u) => [u.id, u]));

      // Cluster 1 bounds
      const c1MinX = Math.min(updateMap.get('item-a')!.x, updateMap.get('item-b')!.x);
      const c1MaxX = Math.max(
        updateMap.get('item-a')!.x + itemA.width,
        updateMap.get('item-b')!.x + itemB.width
      );
      const c1MinY = Math.min(updateMap.get('item-a')!.y, updateMap.get('item-b')!.y);
      const c1MaxY = Math.max(
        updateMap.get('item-a')!.y + itemA.height,
        updateMap.get('item-b')!.y + itemB.height
      );

      // Cluster 2 bounds
      const c2MinX = Math.min(updateMap.get('item-c')!.x, updateMap.get('item-d')!.x);
      const c2MaxX = Math.max(
        updateMap.get('item-c')!.x + itemC.width,
        updateMap.get('item-d')!.x + itemD.width
      );
      const c2MinY = Math.min(updateMap.get('item-c')!.y, updateMap.get('item-d')!.y);
      const c2MaxY = Math.max(
        updateMap.get('item-c')!.y + itemC.height,
        updateMap.get('item-d')!.y + itemD.height
      );

      // Verify edge-to-edge distance is at least 100px
      const xDistance = Math.max(0, Math.max(c1MinX - c2MaxX, c2MinX - c1MaxX));
      const yDistance = Math.max(0, Math.max(c1MinY - c2MaxY, c2MinY - c1MaxY));
      const clusterDistance = Math.max(xDistance, yDistance);

      expect(clusterDistance).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Selection Mode (Arrange Selected Items Only)', () => {
    it('moves only selected items when targetIds is provided and preserves unselected items', () => {
      const item1 = createMockItem('item-1', 'reference', 100, 100, 200, 150);
      const item2 = createMockItem('item-2', 'reference', 150, 150, 200, 150);
      const item3 = createMockItem('item-3', 'idea', 900, 900, 240, 160);

      // Only arrange item-1 and item-2
      const updates = calculateSmartArrange([item1, item2, item3], ['item-1', 'item-2']);

      expect(updates).toHaveLength(2);
      const updatedIds = updates.map((u) => u.id);
      expect(updatedIds).toContain('item-1');
      expect(updatedIds).toContain('item-2');
      expect(updatedIds).not.toContain('item-3');
    });
  });

  describe('Cycle Handling', () => {
    it('terminates quickly and produces valid non-overlapping layout on cyclic graph', () => {
      // Cycle: A -> B -> C -> A
      const itemA = createMockItem('item-a', 'idea', 0, 0, 200, 150, [
        { id: 'c1', targetId: 'item-b' },
      ]);
      const itemB = createMockItem('item-b', 'idea', 100, 0, 200, 150, [
        { id: 'c2', targetId: 'item-c' },
      ]);
      const itemC = createMockItem('item-c', 'idea', 200, 0, 200, 150, [
        { id: 'c3', targetId: 'item-a' },
      ]);

      const startTime = performance.now();
      const updates = calculateSmartArrange([itemA, itemB, itemC]);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(20); // Sub-20ms
      expect(updates).toHaveLength(3);

      const updateMap = new Map(updates.map((u) => [u.id, u]));
      const posA = updateMap.get('item-a')!;
      const posB = updateMap.get('item-b')!;
      const posC = updateMap.get('item-c')!;

      // All 3 items must be non-overlapping
      expect(posA.x === posB.x && posA.y === posB.y).toBe(false);
      expect(posB.x === posC.x && posB.y === posC.y).toBe(false);
    });
  });

  describe('Stroke Protection', () => {
    it('shifts a stroke intersecting a card by the exact same delta as the card', () => {
      // Idea at (100, 100), stroke on top of it at (120, 120)
      const card = createMockItem('card-1', 'idea', 100, 100, 200, 150);
      const stroke = createMockItem('stroke-1', 'stroke', 120, 120, 50, 20);

      const updates = calculateSmartArrange([card, stroke]);
      const updateMap = new Map(updates.map((u) => [u.id, u]));

      expect(updateMap.has('card-1')).toBe(true);
      expect(updateMap.has('stroke-1')).toBe(true);

      const cardPos = updateMap.get('card-1')!;
      const strokePos = updateMap.get('stroke-1')!;

      const cardDeltaX = cardPos.x - card.x;
      const cardDeltaY = cardPos.y - card.y;

      const strokeDeltaX = strokePos.x - stroke.x;
      const strokeDeltaY = strokePos.y - stroke.y;

      expect(strokeDeltaX).toBe(cardDeltaX);
      expect(strokeDeltaY).toBe(cardDeltaY);
    });

    it('does not shove an isolated stroke into a card layout slot', () => {
      const card = createMockItem('card-1', 'idea', 100, 100, 200, 150);
      // Isolated stroke 1000px away from any card
      const stroke = createMockItem('stroke-isolated', 'stroke', 1200, 1200, 80, 40);

      const updates = calculateSmartArrange([card, stroke]);
      const updateMap = new Map(updates.map((u) => [u.id, u]));

      expect(updateMap.has('card-1')).toBe(true);
      // Isolated stroke was not treated as a card
      expect(updateMap.has('stroke-isolated')).toBe(false);
    });
  });

  describe('Determinism Guarantee', () => {
    it('produces identical coordinates regardless of input array ordering', () => {
      const item1 = createMockItem('ref-1', 'reference', 500, 200, 200, 150, [
        { id: 'c1', targetId: 'idea-1' },
      ]);
      const item2 = createMockItem('idea-1', 'idea', 100, 400, 220, 160);
      const item3 = createMockItem('color-1', 'color', 300, 100, 140, 140);
      const item4 = createMockItem('text-1', 'text', 700, 300, 180, 100);

      const orderA = [item1, item2, item3, item4];
      const orderB = [item4, item2, item1, item3];
      const orderC = [item3, item1, item4, item2];

      const resA = calculateSmartArrange(orderA);
      const resB = calculateSmartArrange(orderB);
      const resC = calculateSmartArrange(orderC);

      const mapA = new Map(resA.map((u) => [u.id, `${u.x},${u.y}`]));
      const mapB = new Map(resB.map((u) => [u.id, `${u.x},${u.y}`]));
      const mapC = new Map(resC.map((u) => [u.id, `${u.x},${u.y}`]));

      for (const id of ['ref-1', 'idea-1', 'color-1', 'text-1']) {
        expect(mapA.get(id)).toBe(mapB.get(id));
        expect(mapA.get(id)).toBe(mapC.get(id));
      }
    });
  });

  describe('Backwards Compatibility', () => {
    it('calculateAutoArrange delegates directly to calculateSmartArrange', () => {
      const items = [
        createMockItem('a', 'idea', 0, 0, 200, 150),
        createMockItem('b', 'reference', 300, 0, 200, 150),
      ];

      const autoRes = calculateAutoArrange(items);
      const smartRes = calculateSmartArrange(items);

      expect(autoRes).toEqual(smartRes);
    });

    it('calculateAlignment and calculateDistribution remain fully functional', () => {
      const items = [
        createMockItem('a', 'idea', 100, 100, 100, 100),
        createMockItem('b', 'idea', 300, 100, 100, 100),
      ];

      const aligned = calculateAlignment(items, ['a', 'b'], 'left');
      expect(aligned).toHaveLength(2);
      expect(aligned[0].x).toBe(100);
      expect(aligned[1].x).toBe(100);

      const items3 = [
        createMockItem('a', 'idea', 0, 0, 100, 100),
        createMockItem('b', 'idea', 100, 0, 100, 100),
        createMockItem('c', 'idea', 400, 0, 100, 100),
      ];
      const distributed = calculateDistribution(items3, ['a', 'b', 'c'], 'horizontal');
      expect(distributed).toHaveLength(3);
    });
  });
});
