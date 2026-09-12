import { describe, it, expect } from 'vitest';
import {
  calculateShotDimensions,
  calculateNextScenePosition,
  calculateNextShotPosition,
  calculateMemberShotsDelta,
  isPointOverSceneHeader,
  findIntersectingShots,
  SCENE_HEADER_HEIGHT,
  SCENE_MIN_WIDTH,
  SCENE_MIN_HEIGHT,
} from '../storyboardGeometry';

describe('storyboardGeometry', () => {
  describe('calculateShotDimensions', () => {
    it('calculates 16:9 aspect ratio correctly', () => {
      const { cardWidth, frameHeight, totalHeight } = calculateShotDimensions('16:9', 280);
      expect(cardWidth).toBe(280);
      expect(frameHeight).toBe(Math.round(280 * (9 / 16))); // 158
      expect(totalHeight).toBe(frameHeight + 82);
    });

    it('calculates 9:16 vertical aspect ratio correctly', () => {
      const { cardWidth, frameHeight, totalHeight } = calculateShotDimensions('9:16', 220);
      expect(cardWidth).toBe(220);
      expect(frameHeight).toBe(Math.round(220 * (16 / 9))); // 391
      expect(totalHeight).toBe(frameHeight + 82);
    });

    it('calculates 1:1 square aspect ratio correctly', () => {
      const { cardWidth, frameHeight, totalHeight } = calculateShotDimensions('1:1', 260);
      expect(cardWidth).toBe(260);
      expect(frameHeight).toBe(260);
      expect(totalHeight).toBe(260 + 82);
    });

    it('calculates 4:3 aspect ratio correctly', () => {
      const { cardWidth, frameHeight, totalHeight } = calculateShotDimensions('4:3', 280);
      expect(cardWidth).toBe(280);
      expect(frameHeight).toBe(Math.round(280 * (3 / 4))); // 210
      expect(totalHeight).toBe(210 + 82);
    });

    it('clamps minimum card width to 160px', () => {
      const { cardWidth } = calculateShotDimensions('16:9', 100);
      expect(cardWidth).toBe(160);
    });
  });

  describe('calculateNextScenePosition', () => {
    it('returns sensible initial coordinates when no scenes exist', () => {
      const pos = calculateNextScenePosition([]);
      expect(pos).toEqual({ x: 100, y: 100 });
    });

    it('places new scene to the right of existing scenes', () => {
      const scenes = [
        { x: 100, y: 100, width: 880, height: 560 },
        { x: 1060, y: 100, width: 600, height: 560 },
      ];
      const pos = calculateNextScenePosition(scenes);
      // Rightmost scene ends at 1060 + 600 = 1660. With 80px gap: 1740
      expect(pos).toEqual({ x: 1740, y: 100 });
    });
  });

  describe('calculateNextShotPosition', () => {
    const scene = { x: 200, y: 150, width: 880, height: 600 };

    it('places first shot inside scene with padding and header offset', () => {
      const pos = calculateNextShotPosition(scene, []);
      expect(pos).toEqual({
        x: 200 + 24, // scene.x + padding
        y: 150 + SCENE_HEADER_HEIGHT + 24, // scene.y + header + padding
      });
    });

    it('places subsequent shots spaced in columns/rows', () => {
      const firstShot = { x: 224, y: 218, width: 280, height: 240 };
      const pos2 = calculateNextShotPosition(scene, [firstShot]);
      // Column 1
      expect(pos2.x).toBe(224 + 280 + 24);
      expect(pos2.y).toBe(firstShot.y);
    });
  });

  describe('calculateMemberShotsDelta (Group Movement)', () => {
    it('moves only shots belonging to the specified scene by exactly (dx, dy)', () => {
      const shots = [
        { id: 's1', scene_id: 'scene-1', x: 100, y: 200 },
        { id: 's2', scene_id: 'scene-1', x: 400, y: 200 },
        { id: 's3', scene_id: 'scene-2', x: 800, y: 200 }, // Unrelated shot
      ];

      const deltas = calculateMemberShotsDelta(shots, 'scene-1', 50, -30);

      expect(deltas).toHaveLength(2);
      expect(deltas).toEqual([
        { id: 's1', x: 150, y: 170 },
        { id: 's2', x: 450, y: 170 },
      ]);

      // Confirm s3 is never touched
      expect(deltas.some((d) => d.id === 's3')).toBe(false);
    });

    it('preserves exact relative spatial offsets between member shots', () => {
      const shots = [
        { id: 's1', scene_id: 'scene-1', x: 120, y: 180 },
        { id: 's2', scene_id: 'scene-1', x: 420, y: 220 },
      ];

      const initialDiffX = shots[1].x - shots[0].x;
      const initialDiffY = shots[1].y - shots[0].y;

      const moved = calculateMemberShotsDelta(shots, 'scene-1', 250, 100);
      const movedDiffX = moved[1].x - moved[0].x;
      const movedDiffY = moved[1].y - moved[0].y;

      expect(movedDiffX).toBe(initialDiffX);
      expect(movedDiffY).toBe(initialDiffY);
    });
  });

  describe('isPointOverSceneHeader (Deliberate Drop Reparenting)', () => {
    const scene = { x: 100, y: 100, width: 600, height: 400 };

    it('returns true when point is within scene header bar', () => {
      const point = { x: 200, y: 120 }; // Within header (y: 100..144)
      expect(isPointOverSceneHeader(point, scene)).toBe(true);
    });

    it('returns false when point is in scene body (below header)', () => {
      const point = { x: 200, y: 200 }; // In scene body
      expect(isPointOverSceneHeader(point, scene)).toBe(false);
    });

    it('returns false when point is outside scene entirely', () => {
      const point = { x: 50, y: 120 };
      expect(isPointOverSceneHeader(point, scene)).toBe(false);
    });
  });

  describe('findIntersectingShots (Marquee Selection)', () => {
    const shots = [
      { id: 's1', x: 100, y: 100, width: 100, height: 100 },
      { id: 's2', x: 300, y: 100, width: 100, height: 100 },
      { id: 's3', x: 500, y: 500, width: 100, height: 100 },
    ];

    it('identifies shots intersecting with marquee box', () => {
      const marquee = { x: 50, y: 50, width: 300, height: 200 };
      const result = findIntersectingShots(shots, marquee);
      expect(result).toEqual(['s1', 's2']);
    });

    it('works when marquee is dragged in negative direction', () => {
      const marquee = { x: 350, y: 250, width: -300, height: -200 };
      const result = findIntersectingShots(shots, marquee);
      expect(result).toEqual(['s1', 's2']);
    });

    it('returns empty array if no shots intersect', () => {
      const marquee = { x: 700, y: 700, width: 100, height: 100 };
      const result = findIntersectingShots(shots, marquee);
      expect(result).toEqual([]);
    });
  });

  describe('Scene territory dimensional constraints', () => {
    it('enforces minimum boundary dimensions', () => {
      expect(SCENE_MIN_WIDTH).toBeGreaterThanOrEqual(400);
      expect(SCENE_MIN_HEIGHT).toBeGreaterThanOrEqual(300);
    });
  });
});
