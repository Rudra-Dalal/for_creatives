import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  getAnchorPoint,
  isPointInCornerProtectionZone,
  findClosestCardinalAnchor,
  getOptimalAnchors,
  CARDINAL_ANCHORS,
} from '../geometry/anchorGeometry';
import {
  calculateBezierCurve,
  calculateBezierMidpoint,
} from '../geometry/bezierGeometry';
import { extractActiveConnections } from '../connectionResolution';
import { useConnectorDrag } from '../interaction/useConnectorDrag';
import type { UseConnectorDragOptions } from '../interaction/useConnectorDrag';
import { getConnectedReferenceIdsForIdea } from '../semanticDirection';
import {
  CLICK_VS_DRAG_THRESHOLD_PX,
  CORNER_PRIORITY_ZONE_PX,
  CONNECTOR_SNAP_PROXIMITY_PX,
} from '../../coordinates/constants';
import type { MoodboardItem } from '../../types';

// ---------------------------------------------------------------------------
// Hook Test Harness
// ---------------------------------------------------------------------------

function renderConnectorDrag(opts: UseConnectorDragOptions = {}) {
  let result!: ReturnType<typeof useConnectorDrag>;
  function Harness() {
    result = useConnectorDrag(opts);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

function createMockItem(
  partial: Partial<MoodboardItem> & { id: string; type: MoodboardItem['type'] }
): MoodboardItem {
  return {
    project_id: 'p1',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    z_index: 0,
    reference_id: null,
    created_at: '2026-09-08T00:00:00Z',
    updated_at: '2026-09-08T00:00:00Z',
    deleted_at: null,
    content: {},
    ...partial,
  } as MoodboardItem;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stage 5 — Connectors & Semantic Direction Engine', () => {
  const sampleBounds = { x: 100, y: 100, width: 200, height: 100 };

  // =========================================================================
  // 1. Cardinal Anchor Geometry & Edge Centers
  // =========================================================================
  describe('anchorGeometry — Cardinal Anchor Calculations', () => {
    it('places all 4 cardinal anchors precisely at edge centers', () => {
      // top: (100 + 100, 100) = (200, 100)
      expect(getAnchorPoint(sampleBounds, 'top')).toEqual({ x: 200, y: 100 });
      // right: (100 + 200, 100 + 50) = (300, 150)
      expect(getAnchorPoint(sampleBounds, 'right')).toEqual({ x: 300, y: 150 });
      // bottom: (100 + 100, 100 + 100) = (200, 200)
      expect(getAnchorPoint(sampleBounds, 'bottom')).toEqual({ x: 200, y: 200 });
      // left: (100, 100 + 50) = (100, 150)
      expect(getAnchorPoint(sampleBounds, 'left')).toEqual({ x: 100, y: 150 });
    });

    it('contains exactly the 4 approved cardinal anchor names', () => {
      expect(CARDINAL_ANCHORS).toEqual(['top', 'right', 'bottom', 'left']);
    });
  });

  // =========================================================================
  // 2. Corner Protection Zone (Scale-Aware)
  // =========================================================================
  describe('anchorGeometry — Corner Protection Zone', () => {
    it('detects points within 20px screen-space of any of the 4 card corners at scale = 1', () => {
      // Top-Left corner is at (100, 100)
      expect(isPointInCornerProtectionZone({ x: 105, y: 105 }, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(true);
      expect(isPointInCornerProtectionZone({ x: 100, y: 100 }, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(true);

      // Top-Right corner is at (300, 100)
      expect(isPointInCornerProtectionZone({ x: 295, y: 105 }, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(true);

      // Bottom-Right corner is at (300, 200)
      expect(isPointInCornerProtectionZone({ x: 290, y: 195 }, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(true);

      // Bottom-Left corner is at (100, 200)
      expect(isPointInCornerProtectionZone({ x: 105, y: 195 }, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(true);
    });

    it('scales corner protection zone into world units correctly with zoom', () => {
      // At scale = 2, world zone is 20 / 2 = 10px
      // Point 15px from corner: within zone at scale 1, but outside zone at scale 2
      const point15 = { x: 115, y: 100 };
      expect(isPointInCornerProtectionZone(point15, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(true);
      expect(isPointInCornerProtectionZone(point15, sampleBounds, 2, CORNER_PRIORITY_ZONE_PX)).toBe(false);
    });

    it('returns false for points far from corners, such as edge centers', () => {
      // Top edge center (200, 100) is 100px away from corners
      expect(isPointInCornerProtectionZone({ x: 200, y: 100 }, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(false);
      // Right edge center (300, 150) is 50px away from corners
      expect(isPointInCornerProtectionZone({ x: 300, y: 150 }, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(false);
      // Center of card (200, 150)
      expect(isPointInCornerProtectionZone({ x: 200, y: 150 }, sampleBounds, 1, CORNER_PRIORITY_ZONE_PX)).toBe(false);
    });
  });

  // =========================================================================
  // 3. Magnetic Cardinal Edge Snapping (Scale-Aware 28px Envelope)
  // =========================================================================
  describe('anchorGeometry — Magnetic Cardinal Anchor Snapping', () => {
    it('snaps to the closest cardinal anchor when within the 28px screen envelope', () => {
      // Pointer near right edge at scale = 1 (right edge is at x=300, pointer at x=315 -> 15px < 28px)
      const resRight = findClosestCardinalAnchor({ x: 315, y: 150 }, sampleBounds, 1, CONNECTOR_SNAP_PROXIMITY_PX);
      expect(resRight).not.toBeNull();
      expect(resRight?.anchor).toBe('right');
      expect(resRight?.point).toEqual({ x: 300, y: 150 });

      // Pointer near top edge
      const resTop = findClosestCardinalAnchor({ x: 200, y: 85 }, sampleBounds, 1, CONNECTOR_SNAP_PROXIMITY_PX);
      expect(resTop).not.toBeNull();
      expect(resTop?.anchor).toBe('top');
      expect(resTop?.point).toEqual({ x: 200, y: 100 });
    });

    it('snaps cleanly when pointer is dropped directly over the card body', () => {
      // Pointer at (240, 150) inside the card bounds [100, 100, 200, 100]
      // Nearest anchor is right (300, 150)
      const resInside = findClosestCardinalAnchor({ x: 240, y: 150 }, sampleBounds, 1, CONNECTOR_SNAP_PROXIMITY_PX);
      expect(resInside).not.toBeNull();
      expect(resInside?.anchor).toBe('right');
      expect(resInside?.point).toEqual({ x: 300, y: 150 });
    });

    it('rejects candidate anchors when outside the 28px screen envelope', () => {
      // Pointer 40px away from right edge at scale = 1 -> exceeds 28px
      const resFar = findClosestCardinalAnchor({ x: 345, y: 150 }, sampleBounds, 1, CONNECTOR_SNAP_PROXIMITY_PX);
      expect(resFar).toBeNull();
    });

    it('scales the 28px screen envelope dynamically with viewport zoom', () => {
      // At scale = 2, world distance limit is 28 / 2 = 14px
      // Pointer 20px away from right edge (x = 320)
      // At scale = 1: 20px <= 28px -> snaps
      expect(findClosestCardinalAnchor({ x: 320, y: 150 }, sampleBounds, 1, CONNECTOR_SNAP_PROXIMITY_PX)).not.toBeNull();
      // At scale = 2: 20px > 14px -> rejects
      expect(findClosestCardinalAnchor({ x: 320, y: 150 }, sampleBounds, 2, CONNECTOR_SNAP_PROXIMITY_PX)).toBeNull();
    });

    it('rejects candidate anchors when pointer falls within protected corner zone', () => {
      // Pointer at (305, 105) -> within 20px of top-right corner (300, 100)
      const resCorner = findClosestCardinalAnchor({ x: 305, y: 105 }, sampleBounds, 1, CONNECTOR_SNAP_PROXIMITY_PX);
      expect(resCorner).toBeNull();
    });

    it('determines optimal anchors geometrically without obstacle routing', () => {
      const source = { x: 100, y: 100, width: 100, height: 100 };
      const targetEast = { x: 400, y: 100, width: 100, height: 100 };
      const targetSouth = { x: 100, y: 400, width: 100, height: 100 };

      expect(getOptimalAnchors(source, targetEast)).toEqual({
        fromAnchor: 'right',
        toAnchor: 'left',
      });

      expect(getOptimalAnchors(source, targetSouth)).toEqual({
        fromAnchor: 'bottom',
        toAnchor: 'top',
      });
    });
  });

  // =========================================================================
  // 4. Pure Cubic Bezier Geometry & Exact Midpoint Math
  // =========================================================================
  describe('bezierGeometry — Pure Cubic Bezier & Label Midpoint Math', () => {
    const start = { x: 100, y: 100 };
    const end = { x: 300, y: 100 };

    it('calculates cubic bezier curve with perpendicular control points and flat 8-point array', () => {
      const curve = calculateBezierCurve(start, end, 'right', 'left');

      expect(curve.start).toEqual(start);
      expect(curve.end).toEqual(end);
      // Distance is 200 -> offset = clamp(200 * 0.4, 30, 180) = 80
      expect(curve.cp1).toEqual({ x: 180, y: 100 });
      expect(curve.cp2).toEqual({ x: 220, y: 100 });
      expect(curve.points).toEqual([100, 100, 180, 100, 220, 100, 300, 100]);
    });

    it('calculates exact cubic Bezier midpoint at t = 0.5 for relationship labels', () => {
      const cp1 = { x: 180, y: 100 };
      const cp2 = { x: 220, y: 100 };

      const midpoint = calculateBezierMidpoint(start, cp1, cp2, end, 0.5);
      expect(midpoint).toEqual({ x: 200, y: 100 });
    });
  });

  // =========================================================================
  // 5. Connection Resolution Domain
  // =========================================================================
  describe('connectionResolution — Semantic Extraction', () => {
    it('extracts active connections and filters out non-existent or deleted items', () => {
      const items: MoodboardItem[] = [
        createMockItem({
          id: 'card-1',
          type: 'idea',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          content: {
            connections: [
              { id: 'c1', targetId: 'card-2', fromAnchor: 'right', toAnchor: 'left', label: 'supports' },
              { id: 'c2', targetId: 'card-deleted', fromAnchor: 'right', toAnchor: 'left' },
              { id: 'c3', targetId: 'card-1' }, // self connection filtered out
            ],
          },
        }),
        createMockItem({
          id: 'card-2',
          type: 'reference',
          x: 300,
          y: 0,
          width: 100,
          height: 100,
        }),
        createMockItem({
          id: 'card-deleted',
          type: 'reference',
          x: 500,
          y: 0,
          width: 100,
          height: 100,
          deleted_at: '2026-09-08T00:00:00Z',
        }),
      ];

      const resolved = extractActiveConnections(items);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].id).toBe('c1');
      expect(resolved[0].fromId).toBe('card-1');
      expect(resolved[0].targetId).toBe('card-2');
      expect(resolved[0].label).toBe('supports');
    });
  });

  // =========================================================================
  // 6. useConnectorDrag — Single Authoritative Controller
  // =========================================================================
  describe('useConnectorDrag — Threshold & Magnetic Interaction', () => {
    const candidateCards: MoodboardItem[] = [
      createMockItem({
        id: 'card-source',
        type: 'idea',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
      }),
      createMockItem({
        id: 'card-target',
        type: 'reference',
        x: 300,
        y: 50,
        width: 100,
        height: 100,
      }),
      createMockItem({
        id: 'stroke-1',
        type: 'stroke',
        x: 200,
        y: 200,
        width: 50,
        height: 50,
      }),
    ];

    it('enforces CLICK_VS_DRAG_THRESHOLD_PX (4px) before activating live connector', () => {
      const hook = renderConnectorDrag();

      hook.startConnecting('card-source', 'right', { x: 150, y: 100 });
      expect(hook.isConnecting).toBe(true);
      expect(hook.isDragThresholdExceeded).toBe(false);

      // Move 2px (below 4px threshold)
      hook.updateConnecting({ x: 152, y: 100 }, candidateCards, 1);
      expect(hook.isDragThresholdExceeded).toBe(false);

      // Move 5px (exceeds 4px threshold)
      hook.updateConnecting({ x: 155, y: 100 }, candidateCards, 1);
      expect(hook.isDragThresholdExceeded).toBe(true);
    });

    it('magnetically snaps to candidate card edge anchor using scale-aware 28px envelope', () => {
      const hook = renderConnectorDrag();

      hook.startConnecting('card-source', 'right', { x: 150, y: 100 });

      // card-target is at x: 300, y: 50 (width: 100, height: 100). Left anchor is at (300, 100).
      // Pointer at (290, 100) -> 10px from left edge (< 28px envelope at scale = 1)
      hook.updateConnecting({ x: 290, y: 100 }, candidateCards, 1);

      expect(hook.connectingTarget).not.toBeNull();
      expect(hook.connectingTarget?.itemId).toBe('card-target');
      expect(hook.connectingTarget?.anchor).toBe('left');
      expect(hook.connectingTarget?.snapPoint).toEqual({ x: 300, y: 100 });
    });

    it('does NOT snap to candidate card when pointer is in corner protection zone', () => {
      const hook = renderConnectorDrag();

      hook.startConnecting('card-source', 'right', { x: 150, y: 100 });

      // Pointer at (305, 55) -> near card-target top-left corner (within 20px)
      hook.updateConnecting({ x: 305, y: 55 }, candidateCards, 1);

      // Should refuse to snap to cardinal anchor in the corner protection zone
      expect(hook.connectingTarget).toBeNull();
    });

    it('never snaps to stroke items or self', () => {
      const hook = renderConnectorDrag();

      hook.startConnecting('card-source', 'right', { x: 150, y: 100 });

      // Pointer hovering over self
      hook.updateConnecting({ x: 60, y: 60 }, candidateCards, 1);
      expect(hook.connectingTarget).toBeNull();

      // Pointer hovering over stroke item
      hook.updateConnecting({ x: 210, y: 210 }, candidateCards, 1);
      expect(hook.connectingTarget).toBeNull();
    });

    it('commits connection on finishConnecting when threshold met and target snapped', () => {
      const onAddConnection = vi.fn();
      const hook = renderConnectorDrag({ onAddConnection });

      hook.startConnecting('card-source', 'right', { x: 150, y: 100 });
      hook.updateConnecting({ x: 290, y: 100 }, candidateCards, 1); // snaps to target and exceeds 4px

      const committed = hook.finishConnecting();
      expect(committed).toBe(true);
      expect(onAddConnection).toHaveBeenCalledWith('card-source', 'card-target', 'right', 'left');
      expect(hook.isConnecting).toBe(false);
      expect(hook.connectingTarget).toBeNull();
    });

    it('cancels cleanly without committing when finishConnecting is called without a target', () => {
      const onAddConnection = vi.fn();
      const hook = renderConnectorDrag({ onAddConnection });

      hook.startConnecting('card-source', 'right', { x: 150, y: 100 });
      hook.updateConnecting({ x: 180, y: 100 }, candidateCards, 1); // empty space

      const committed = hook.finishConnecting();
      expect(committed).toBe(false);
      expect(onAddConnection).not.toHaveBeenCalled();
      expect(hook.isConnecting).toBe(false);
    });
  });

  // =========================================================================
  // 7. Semantic Direction Linking
  // =========================================================================
  describe('semanticDirection — Bidirectional Reference Extraction', () => {
    it('extracts all connected Reference IDs bidirectionally for an Idea item', () => {
      const items: MoodboardItem[] = [
        createMockItem({
          id: 'idea-1',
          type: 'idea',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          content: {
            title: 'Tactile Minimalism',
            notes: 'Warm brutalist typography',
            connections: [
              // Forward connection: Idea -> Ref A
              { id: 'conn-1', targetId: 'card-ref-a', fromAnchor: 'right', toAnchor: 'left' },
              // Connection to another Idea (should NOT be included in reference IDs)
              { id: 'conn-2', targetId: 'card-other-idea', fromAnchor: 'bottom', toAnchor: 'top' },
            ],
          },
        }),
        createMockItem({
          id: 'card-ref-a',
          type: 'reference',
          reference_id: 'ref-uuid-aaa',
          x: 200,
          y: 0,
          width: 100,
          height: 100,
        }),
        createMockItem({
          id: 'card-ref-b',
          type: 'reference',
          reference_id: 'ref-uuid-bbb',
          x: 0,
          y: 200,
          width: 100,
          height: 100,
          content: {
            // Reverse connection: Ref B -> Idea
            connections: [
              { id: 'conn-3', targetId: 'idea-1', fromAnchor: 'top', toAnchor: 'bottom' },
            ],
          },
        }),
        createMockItem({
          id: 'card-other-idea',
          type: 'idea',
          x: 0,
          y: 400,
          width: 100,
          height: 100,
        }),
      ];

      const connectedRefIds = getConnectedReferenceIdsForIdea('idea-1', items);
      expect(connectedRefIds).toHaveLength(2);
      expect(connectedRefIds).toContain('ref-uuid-aaa');
      expect(connectedRefIds).toContain('ref-uuid-bbb');
    });

    it('returns empty array when Idea has no connected references', () => {
      const items: MoodboardItem[] = [
        createMockItem({
          id: 'idea-standalone',
          type: 'idea',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        }),
      ];

      const connectedRefIds = getConnectedReferenceIdsForIdea('idea-standalone', items);
      expect(connectedRefIds).toEqual([]);
    });
  });
});
