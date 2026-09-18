import { describe, it, expect } from 'vitest';
import {
  getShotAnchorPoint,
  getOptimalShotAnchors,
  calculateSequenceBezierCurve,
  findClosestShotAnchor,
  isSelfConnection,
  isDuplicateConnection,
  isReverseConnection,
  CARDINAL_ANCHORS,
  DEFAULT_SNAP_PROXIMITY_PX,
  type ShotSpatialInput,
} from '../storyboardConnections';
import { calculateShotDimensions } from '../storyboardGeometry';

describe('storyboardConnections', () => {
  describe('1. Exact Anchor Coordinates across Aspect Ratios', () => {
    it('calculates exact anchors for 16:9 cinematic widescreen', () => {
      const shot: ShotSpatialInput = {
        id: 'shot-1',
        x: 100,
        y: 200,
        width: 280,
        aspect_ratio: '16:9',
      };
      const dims = calculateShotDimensions('16:9', 280);
      expect(dims.cardWidth).toBe(280);
      expect(dims.totalHeight).toBe(240); // 158 + 82

      expect(getShotAnchorPoint(shot, 'top')).toEqual({ x: 240, y: 200 });
      expect(getShotAnchorPoint(shot, 'right')).toEqual({ x: 380, y: 320 });
      expect(getShotAnchorPoint(shot, 'bottom')).toEqual({ x: 240, y: 440 });
      expect(getShotAnchorPoint(shot, 'left')).toEqual({ x: 100, y: 320 });
    });

    it('calculates exact anchors for 9:16 vertical video', () => {
      const shot: ShotSpatialInput = {
        id: 'shot-vertical',
        x: 0,
        y: 0,
        width: 220,
        aspect_ratio: '9:16',
      };
      const dims = calculateShotDimensions('9:16', 220);
      expect(dims.cardWidth).toBe(220);
      expect(dims.totalHeight).toBe(473); // 391 + 82

      expect(getShotAnchorPoint(shot, 'top')).toEqual({ x: 110, y: 0 });
      expect(getShotAnchorPoint(shot, 'right')).toEqual({ x: 220, y: 237 });
      expect(getShotAnchorPoint(shot, 'bottom')).toEqual({ x: 110, y: 473 });
      expect(getShotAnchorPoint(shot, 'left')).toEqual({ x: 0, y: 237 });
    });

    it('calculates exact anchors for 1:1 square framing', () => {
      const shot: ShotSpatialInput = {
        id: 'shot-sq',
        x: 50,
        y: 50,
        width: 260,
        aspect_ratio: '1:1',
      };
      const dims = calculateShotDimensions('1:1', 260);
      expect(dims.cardWidth).toBe(260);
      expect(dims.totalHeight).toBe(342); // 260 + 82

      expect(getShotAnchorPoint(shot, 'top')).toEqual({ x: 180, y: 50 });
      expect(getShotAnchorPoint(shot, 'right')).toEqual({ x: 310, y: 221 });
      expect(getShotAnchorPoint(shot, 'bottom')).toEqual({ x: 180, y: 392 });
      expect(getShotAnchorPoint(shot, 'left')).toEqual({ x: 50, y: 221 });
    });

    it('calculates exact anchors for 4:3 classic framing', () => {
      const shot: ShotSpatialInput = {
        id: 'shot-classic',
        x: 100,
        y: 100,
        width: 280,
        aspect_ratio: '4:3',
      };
      const dims = calculateShotDimensions('4:3', 280);
      expect(dims.cardWidth).toBe(280);
      expect(dims.totalHeight).toBe(292); // 210 + 82

      expect(getShotAnchorPoint(shot, 'top')).toEqual({ x: 240, y: 100 });
      expect(getShotAnchorPoint(shot, 'right')).toEqual({ x: 380, y: 246 });
      expect(getShotAnchorPoint(shot, 'bottom')).toEqual({ x: 240, y: 392 });
      expect(getShotAnchorPoint(shot, 'left')).toEqual({ x: 100, y: 246 });
    });

    it('defaults gracefully when aspect ratio is null or undefined', () => {
      const shot: ShotSpatialInput = {
        x: 200,
        y: 300,
      };
      const top = getShotAnchorPoint(shot, 'top');
      expect(top).toEqual({ x: 340, y: 300 }); // 200 + 280/2 = 340
    });
  });

  describe('2. Bézier Curve Validity & Tangent Geometry', () => {
    it('produces valid 8-point representation and preserves endpoints', () => {
      const start = { x: 100, y: 200 };
      const end = { x: 500, y: 200 };
      const curve = calculateSequenceBezierCurve(start, end, 'right', 'left');

      expect(curve.start).toEqual(start);
      expect(curve.end).toEqual(end);
      expect(curve.points).toHaveLength(8);
      expect(curve.points[0]).toBe(start.x);
      expect(curve.points[1]).toBe(start.y);
      expect(curve.points[6]).toBe(end.x);
      expect(curve.points[7]).toBe(end.y);
    });

    it('control points strictly respect anchor tangent normals', () => {
      // Horizontal right -> left
      const start = { x: 100, y: 200 };
      const end = { x: 500, y: 200 };
      const curveH = calculateSequenceBezierCurve(start, end, 'right', 'left');

      // Right anchor projects in +X direction
      expect(curveH.controlPoint1.x).toBeGreaterThan(start.x);
      expect(curveH.controlPoint1.y).toBe(start.y);

      // Left anchor is approached from -X direction
      expect(curveH.controlPoint2.x).toBeLessThan(end.x);
      expect(curveH.controlPoint2.y).toBe(end.y);

      // Vertical bottom -> top
      const topStart = { x: 200, y: 100 };
      const bottomEnd = { x: 200, y: 600 };
      const curveV = calculateSequenceBezierCurve(topStart, bottomEnd, 'bottom', 'top');

      // Bottom anchor projects in +Y direction
      expect(curveV.controlPoint1.y).toBeGreaterThan(topStart.y);
      expect(curveV.controlPoint1.x).toBe(topStart.x);

      // Top anchor approached from -Y direction
      expect(curveV.controlPoint2.y).toBeLessThan(bottomEnd.y);
      expect(curveV.controlPoint2.x).toBe(bottomEnd.x);
    });

    it('bounds curvature offset smoothly for nearby shots without extreme looping', () => {
      const nearStart = { x: 100, y: 100 };
      const nearEnd = { x: 120, y: 100 }; // 20px apart
      const curveNear = calculateSequenceBezierCurve(nearStart, nearEnd, 'right', 'left');

      // Offset clamped at minimum 24px
      expect(curveNear.controlPoint1.x - nearStart.x).toBe(24);
      expect(nearEnd.x - curveNear.controlPoint2.x).toBe(24);
    });
  });

  describe('3. Midpoint Calculation B(0.5)', () => {
    it('computes exact symmetric midpoint on straight horizontal segment', () => {
      const start = { x: 100, y: 200 };
      const end = { x: 500, y: 200 };
      const curve = calculateSequenceBezierCurve(start, end, 'right', 'left');

      // On a horizontally symmetric curve, mid.x is exactly halfway (300) and mid.y is 200
      expect(curve.midpoint.x).toBe(300);
      expect(curve.midpoint.y).toBe(200);
    });

    it('computes exact midpoint on angled curve', () => {
      const start = { x: 100, y: 100 };
      const end = { x: 500, y: 500 };
      const curve = calculateSequenceBezierCurve(start, end, 'right', 'left');

      // Midpoint lies between endpoints
      expect(curve.midpoint.x).toBeGreaterThan(start.x);
      expect(curve.midpoint.x).toBeLessThan(end.x);
      expect(curve.midpoint.y).toBeGreaterThan(start.y);
      expect(curve.midpoint.y).toBeLessThan(end.y);
    });
  });

  describe('4. Optimal Anchor Selection', () => {
    const defaultShot: ShotSpatialInput = {
      width: 280,
      aspect_ratio: '16:9',
      x: 0,
      y: 0,
    };

    it('chooses right -> left when source is to the left of target', () => {
      const source = { ...defaultShot, x: 100, y: 100 };
      const target = { ...defaultShot, x: 600, y: 100 };
      const result = getOptimalShotAnchors(source, target);
      expect(result).toEqual({ fromAnchor: 'right', toAnchor: 'left' });
    });

    it('chooses left -> right when source is to the right of target', () => {
      const source = { ...defaultShot, x: 600, y: 100 };
      const target = { ...defaultShot, x: 100, y: 100 };
      const result = getOptimalShotAnchors(source, target);
      expect(result).toEqual({ fromAnchor: 'left', toAnchor: 'right' });
    });

    it('chooses bottom -> top when source is above target', () => {
      const source = { ...defaultShot, x: 100, y: 100 };
      const target = { ...defaultShot, x: 100, y: 600 };
      const result = getOptimalShotAnchors(source, target);
      expect(result).toEqual({ fromAnchor: 'bottom', toAnchor: 'top' });
    });

    it('chooses top -> bottom when source is below target', () => {
      const source = { ...defaultShot, x: 100, y: 600 };
      const target = { ...defaultShot, x: 100, y: 100 };
      const result = getOptimalShotAnchors(source, target);
      expect(result).toEqual({ fromAnchor: 'top', toAnchor: 'bottom' });
    });
  });

  describe('5. Overlapping / Near-Overlapping Shots', () => {
    it('returns deterministic right -> left when source and target are exactly overlapping', () => {
      const source: ShotSpatialInput = { x: 200, y: 200, width: 280, aspect_ratio: '16:9' };
      const target: ShotSpatialInput = { x: 200, y: 200, width: 280, aspect_ratio: '16:9' };
      const result = getOptimalShotAnchors(source, target);
      expect(result).toEqual({ fromAnchor: 'right', toAnchor: 'left' });
    });

    it('handles tie at 45 degree diagonal with deterministic horizontal preference', () => {
      const source: ShotSpatialInput = { x: 100, y: 100, width: 280, aspect_ratio: '16:9' };
      const target: ShotSpatialInput = { x: 400, y: 400, width: 280, aspect_ratio: '16:9' };
      // dx === 300, dy === 300 => |dx| >= |dy| => horizontal right -> left
      const result = getOptimalShotAnchors(source, target);
      expect(result).toEqual({ fromAnchor: 'right', toAnchor: 'left' });
    });
  });

  describe('6. Magnetic Anchor Snapping', () => {
    const candidateA: ShotSpatialInput = {
      id: 'shot-A',
      x: 100,
      y: 100,
      width: 280,
      aspect_ratio: '16:9',
    };
    const candidateB: ShotSpatialInput = {
      id: 'shot-B',
      x: 600,
      y: 100,
      width: 280,
      aspect_ratio: '16:9',
    };

    it('snaps to nearest anchor when pointer is inside snap threshold', () => {
      // Shot B left anchor is at (600, 100 + 120) = (600, 220)
      const pointerNearBLeft = { x: 590, y: 220 }; // 10px away
      const snap = findClosestShotAnchor(pointerNearBLeft, [candidateA, candidateB], {
        scale: 1,
        snapProximityPx: 28,
      });

      expect(snap).not.toBeNull();
      expect(snap?.shotId).toBe('shot-B');
      expect(snap?.anchor).toBe('left');
      expect(snap?.point).toEqual({ x: 600, y: 220 });
      expect(snap?.distance).toBe(10);
    });

    it('returns null when pointer is outside snap threshold', () => {
      const pointerFarAway = { x: 450, y: 220 }; // ~150px away from both shots
      const snap = findClosestShotAnchor(pointerFarAway, [candidateA, candidateB], {
        scale: 1,
        snapProximityPx: 28,
      });

      expect(snap).toBeNull();
    });

    it('converts snap threshold correctly based on viewport scale', () => {
      // When zoomed out (scale = 0.5), world snap distance is 28 / 0.5 = 56px
      const pointerAt40px = { x: 560, y: 220 }; // 40px from (600, 220)

      // At scale 1.0 (threshold 28px): out of reach
      const snapScale1 = findClosestShotAnchor(pointerAt40px, [candidateA, candidateB], {
        scale: 1.0,
        snapProximityPx: 28,
      });
      expect(snapScale1).toBeNull();

      // At scale 0.5 (threshold 56px): snaps cleanly!
      const snapScaleHalf = findClosestShotAnchor(pointerAt40px, [candidateA, candidateB], {
        scale: 0.5,
        snapProximityPx: 28,
      });
      expect(snapScaleHalf).not.toBeNull();
      expect(snapScaleHalf?.shotId).toBe('shot-B');
      expect(snapScaleHalf?.anchor).toBe('left');
    });

    it('never snaps to originating shot when excludeShotId is passed', () => {
      // Pointer is right on candidateA's right anchor (380, 220)
      const pointerOnA = { x: 380, y: 220 };

      const snapExcluded = findClosestShotAnchor(pointerOnA, [candidateA, candidateB], {
        excludeShotId: 'shot-A',
        snapProximityPx: 28,
      });

      // Does not return candidate A
      expect(snapExcluded).toBeNull();
    });

    it('breaks ties deterministically by selecting smaller distance', () => {
      // Place pointer slightly closer to top anchor than right anchor
      const topPt = getShotAnchorPoint(candidateA, 'top'); // (240, 100)
      const pointer = { x: 240, y: 85 }; // 15px from top

      const snap = findClosestShotAnchor(pointer, [candidateA]);
      expect(snap?.anchor).toBe('top');
    });
  });

  describe('7. Self Connection Rejection', () => {
    it('rejects self connection where source and target IDs match', () => {
      expect(isSelfConnection('shot-1', 'shot-1')).toBe(true);
      expect(isSelfConnection('shot-1', 'shot-2')).toBe(false);
    });

    it('returns false if either ID is empty', () => {
      expect(isSelfConnection('', 'shot-1')).toBe(false);
      expect(isSelfConnection('shot-1', '')).toBe(false);
    });
  });

  describe('8. Duplicate Directed Connection Detection', () => {
    const existing = [
      { from_shot_id: 'shot-A', to_shot_id: 'shot-B', deleted_at: null },
      { from_shot_id: 'shot-B', to_shot_id: 'shot-C', deleted_at: '2026-09-18T00:00:00Z' }, // soft-deleted
    ];

    it('identifies existing active directed connection as duplicate', () => {
      expect(isDuplicateConnection(existing, 'shot-A', 'shot-B')).toBe(true);
    });

    it('allows new connection when no directed connection exists', () => {
      expect(isDuplicateConnection(existing, 'shot-A', 'shot-C')).toBe(false);
    });

    it('ignores soft-deleted connection as not duplicate', () => {
      expect(isDuplicateConnection(existing, 'shot-B', 'shot-C')).toBe(false);
    });
  });

  describe('9. Reverse Connection Independence (A -> B vs B -> A)', () => {
    const existing = [
      { from_shot_id: 'shot-A', to_shot_id: 'shot-B', deleted_at: null },
    ];

    it('treats reverse connection B -> A as distinct from A -> B', () => {
      // A -> B is duplicate
      expect(isDuplicateConnection(existing, 'shot-A', 'shot-B')).toBe(true);

      // B -> A is NOT a duplicate (directed sequence!)
      expect(isDuplicateConnection(existing, 'shot-B', 'shot-A')).toBe(false);
    });

    it('detects whether a reverse connection exists', () => {
      expect(isReverseConnection(existing, 'shot-B', 'shot-A')).toBe(true);
      expect(isReverseConnection(existing, 'shot-A', 'shot-B')).toBe(false);
    });
  });

  describe('10. Determinism', () => {
    it('produces identical output for identical inputs across multiple runs', () => {
      const shot: ShotSpatialInput = { x: 123, y: 456, width: 280, aspect_ratio: '16:9' };
      const pt1 = getShotAnchorPoint(shot, 'right');
      const pt2 = getShotAnchorPoint(shot, 'right');
      expect(pt1).toEqual(pt2);

      const target: ShotSpatialInput = { x: 789, y: 456, width: 280, aspect_ratio: '16:9' };
      const opt1 = getOptimalShotAnchors(shot, target);
      const opt2 = getOptimalShotAnchors(shot, target);
      expect(opt1).toEqual(opt2);

      const curve1 = calculateSequenceBezierCurve(pt1, { x: 789, y: 576 }, opt1.fromAnchor, opt1.toAnchor);
      const curve2 = calculateSequenceBezierCurve(pt1, { x: 789, y: 576 }, opt2.fromAnchor, opt2.toAnchor);
      expect(curve1).toEqual(curve2);
    });
  });
});
