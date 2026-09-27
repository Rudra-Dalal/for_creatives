import { describe, it, expect } from 'vitest';
import {
  simplifyStrokePoints,
  isPointHittingStroke,
  isPathHittingStroke,
} from '../storyboardStrokeUtils';
import type { StoryboardStroke } from '../../types';

function createMockStroke(overrides: Partial<StoryboardStroke> = {}): StoryboardStroke {
  return {
    id: 'test-stroke-1',
    project_id: 'test-project-1',
    points: [0, 0, 100, 0],
    stroke_color: '#D97706',
    stroke_width: 4,
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('storyboardStrokeUtils', () => {
  describe('simplifyStrokePoints', () => {
    it('returns empty array when given an empty array', () => {
      expect(simplifyStrokePoints([])).toEqual([]);
    });

    it('returns empty array when given an array with fewer than 2 elements or invalid inputs', () => {
      expect(simplifyStrokePoints([10])).toEqual([]);
      expect(simplifyStrokePoints(null as unknown as number[])).toEqual([]);
    });

    it('expands a single point [x, y] to a minimal 2-point segment [x, y, x + 0.1, y + 0.1]', () => {
      const result = simplifyStrokePoints([50, 100]);
      expect(result).toEqual([50, 100, 50.1, 100.1]);
    });

    it('preserves exactly two points [x0, y0, x1, y1]', () => {
      const input = [10, 20, 110, 120];
      const result = simplifyStrokePoints(input);
      expect(result).toEqual([10, 20, 110, 120]);
    });

    it('simplifies perfectly collinear points down to just start and end', () => {
      // 5 points in a straight line from (0, 0) to (100, 0)
      const input = [0, 0, 25, 0, 50, 0, 75, 0, 100, 0];
      const result = simplifyStrokePoints(input, 1.5);
      expect(result).toEqual([0, 0, 100, 0]);
    });

    it('preserves start and end points strictly', () => {
      const input = [15.2, 33.4, 40, 80, 70, 95.8];
      const result = simplifyStrokePoints(input, 1.5);
      expect(result[0]).toBe(15.2);
      expect(result[1]).toBe(33.4);
      expect(result[result.length - 2]).toBe(70);
      expect(result[result.length - 1]).toBe(95.8);
    });

    it('reduces noise on a curved path while preserving the overall shape', () => {
      // S-curve with small jitter
      const input = [
        0, 0,
        10, 0.2, // tiny jitter
        20, 10,
        30, 20,
        40, 20.1, // tiny jitter
        50, 10,
        60, 0,
      ];
      const result = simplifyStrokePoints(input, 1.5);
      expect(result.length).toBeLessThan(input.length);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
      expect(result[result.length - 2]).toBe(60);
      expect(result[result.length - 1]).toBe(0);
    });

    it('filters out closely-spaced points below the 1.0 radial threshold', () => {
      const input = [
        0, 0,
        0.3, 0.3, // distance ~0.42 < 1.0 -> should be filtered by radial pre-filter
        0.5, 0.5, // distance ~0.71 < 1.0 from origin
        10, 10,
        20, 20,
      ];
      const result = simplifyStrokePoints(input, 0.5);
      expect(result).toEqual([0, 0, 20, 20]);
    });

    it('respects tolerance sensitivity (higher tolerance removes more points)', () => {
      const arc = [
        0, 0,
        10, 5,
        20, 8,
        30, 9,
        40, 8,
        50, 5,
        60, 0,
      ];
      const tight = simplifyStrokePoints(arc, 0.1);
      const loose = simplifyStrokePoints(arc, 10.0);
      expect(loose.length).toBeLessThanOrEqual(tight.length);
      expect(loose).toEqual([0, 0, 60, 0]);
    });

    it('is completely deterministic over repeated executions', () => {
      const input = [0, 0, 5, 2, 10, 15, 20, 30, 25, 45, 30, 60];
      const run1 = simplifyStrokePoints(input, 1.5);
      const run2 = simplifyStrokePoints(input, 1.5);
      const run3 = simplifyStrokePoints(input, 1.5);
      expect(run1).toEqual(run2);
      expect(run2).toEqual(run3);
    });

    it('rounds persisted coordinates to 1 decimal place', () => {
      const input = [1.2345, 2.3456, 10.8765, 20.9876];
      const result = simplifyStrokePoints(input);
      expect(result).toEqual([1.2, 2.3, 10.9, 21.0]);
    });
  });

  describe('isPointHittingStroke', () => {
    it('returns true when query point is directly on a stroke segment', () => {
      const stroke = createMockStroke({ points: [0, 0, 100, 0] });
      expect(isPointHittingStroke(50, 0, stroke, 14)).toBe(true);
    });

    it('returns true when query point is near the stroke within effective radius', () => {
      // Stroke width 4 -> effective radius = max(14, 4/2 + 8) = 14
      const stroke = createMockStroke({ points: [0, 0, 100, 0], stroke_width: 4 });
      expect(isPointHittingStroke(50, 10, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(50, -13, stroke, 14)).toBe(true);
    });

    it('returns false when query point is outside the effective radius', () => {
      const stroke = createMockStroke({ points: [0, 0, 100, 0], stroke_width: 4 });
      expect(isPointHittingStroke(50, 20, stroke, 14)).toBe(false);
    });

    it('quickly rejects points far outside the AABB bounding box', () => {
      const stroke = createMockStroke({ points: [0, 0, 100, 100] });
      expect(isPointHittingStroke(500, 500, stroke, 14)).toBe(false);
      expect(isPointHittingStroke(-200, 50, stroke, 14)).toBe(false);
    });

    it('correctly tests multi-segment strokes', () => {
      // L-shaped stroke: (0,0) -> (0, 100) -> (100, 100)
      const stroke = createMockStroke({ points: [0, 0, 0, 100, 100, 100] });
      expect(isPointHittingStroke(0, 50, stroke, 14)).toBe(true); // on first segment
      expect(isPointHittingStroke(50, 100, stroke, 14)).toBe(true); // on second segment
      expect(isPointHittingStroke(50, 50, stroke, 14)).toBe(false); // in the empty middle
    });

    it('accounts for thick strokes expanding the effective hit radius', () => {
      // Stroke width 30 -> effective radius = max(14, 30/2 + 8) = 23
      const stroke = createMockStroke({ points: [0, 0, 100, 0], stroke_width: 30 });
      expect(isPointHittingStroke(50, 20, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(50, 25, stroke, 14)).toBe(false);
    });

    it('returns false immediately if the stroke is soft-deleted', () => {
      const stroke = createMockStroke({
        points: [0, 0, 100, 0],
        deleted_at: '2026-09-27T00:00:00Z',
      });
      expect(isPointHittingStroke(50, 0, stroke, 14)).toBe(false);
    });

    it('returns false for empty or invalid stroke points', () => {
      expect(isPointHittingStroke(0, 0, createMockStroke({ points: [] }))).toBe(false);
      expect(isPointHittingStroke(0, 0, createMockStroke({ points: [10, 20] }))).toBe(false);
      expect(isPointHittingStroke(0, 0, createMockStroke({ points: 'invalid-json' }))).toBe(false);
      expect(isPointHittingStroke(0, 0, createMockStroke({ points: null as unknown as number[] }))).toBe(false);
    });

    it('handles JSON string-serialized points seamlessly', () => {
      const stroke = createMockStroke({
        points: JSON.stringify([0, 0, 100, 0]) as unknown as number[],
      });
      expect(isPointHittingStroke(50, 0, stroke, 14)).toBe(true);
    });
  });

  describe('isPathHittingStroke', () => {
    it('detects a slow intersecting path across a stroke', () => {
      // Horizontal stroke from (0, 50) to (100, 50)
      const stroke = createMockStroke({ points: [0, 50, 100, 50] });
      // Slow vertical sweep from (50, 40) to (50, 60)
      expect(isPathHittingStroke(50, 40, 50, 60, stroke, 14)).toBe(true);
    });

    it('detects a fast sweep that crosses the stroke in a single large step', () => {
      // Vertical stroke at x = 100, y from 0 to 200
      const stroke = createMockStroke({ points: [100, 0, 100, 200] });
      // Fast horizontal sweep from x = 0 to x = 300 at y = 100 (sweep distance = 300)
      expect(isPathHittingStroke(0, 100, 300, 100, stroke, 14)).toBe(true);
    });

    it('returns false for a path running parallel but outside the stroke hit zone', () => {
      // Horizontal stroke from (0, 50) to (100, 50)
      const stroke = createMockStroke({ points: [0, 50, 100, 50] });
      // Path parallel at y = 100 (50 units away)
      expect(isPathHittingStroke(0, 100, 100, 100, stroke, 14)).toBe(false);
    });

    it('detects a path ending right near the stroke', () => {
      const stroke = createMockStroke({ points: [0, 0, 100, 0] });
      expect(isPathHittingStroke(50, 100, 50, 5, stroke, 14)).toBe(true);
    });

    it('returns false for completely unrelated or distant paths', () => {
      const stroke = createMockStroke({ points: [0, 0, 100, 0] });
      expect(isPathHittingStroke(500, 500, 600, 600, stroke, 14)).toBe(false);
    });

    it('returns false if stroke is soft-deleted even when path crosses directly', () => {
      const stroke = createMockStroke({
        points: [0, 50, 100, 50],
        deleted_at: '2026-09-27T00:00:00Z',
      });
      expect(isPathHittingStroke(50, 0, 50, 100, stroke, 14)).toBe(false);
    });

    it('handles zero-length path (click without drag)', () => {
      const stroke = createMockStroke({ points: [0, 0, 100, 0] });
      expect(isPathHittingStroke(50, 0, 50, 0, stroke, 14)).toBe(true);
      expect(isPathHittingStroke(50, 100, 50, 100, stroke, 14)).toBe(false);
    });
  });

  describe('numerical edge cases', () => {
    it('handles vertical segments correctly', () => {
      const stroke = createMockStroke({ points: [50, 0, 50, 100] });
      expect(isPointHittingStroke(50, 50, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(60, 50, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(70, 50, stroke, 14)).toBe(false);
    });

    it('handles horizontal segments correctly', () => {
      const stroke = createMockStroke({ points: [0, 50, 100, 50] });
      expect(isPointHittingStroke(50, 50, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(50, 60, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(50, 70, stroke, 14)).toBe(false);
    });

    it('handles diagonal segments correctly', () => {
      const stroke = createMockStroke({ points: [0, 0, 100, 100] });
      // Point (50, 50) is directly on the diagonal
      expect(isPointHittingStroke(50, 50, stroke, 14)).toBe(true);
      // Point (50, 60) distance is 10 / sqrt(2) ≈ 7.07 < 14
      expect(isPointHittingStroke(50, 60, stroke, 14)).toBe(true);
      // Point (50, 80) distance is 30 / sqrt(2) ≈ 21.21 > 14
      expect(isPointHittingStroke(50, 80, stroke, 14)).toBe(false);
    });

    it('handles zero-length segments without NaN or crash', () => {
      const stroke = createMockStroke({ points: [50, 50, 50, 50] });
      expect(isPointHittingStroke(50, 50, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(60, 50, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(100, 100, stroke, 14)).toBe(false);
    });

    it('handles very small floating-point coordinates', () => {
      const stroke = createMockStroke({ points: [0.001, 0.001, 0.002, 0.002] });
      expect(isPointHittingStroke(0.0015, 0.0015, stroke, 14)).toBe(true);
    });

    it('handles large world coordinates without numeric overflow or degradation', () => {
      const stroke = createMockStroke({
        points: [100000, 200000, 100100, 200000],
      });
      expect(isPointHittingStroke(100050, 200000, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(100050, 200010, stroke, 14)).toBe(true);
      expect(isPointHittingStroke(100050, 200030, stroke, 14)).toBe(false);
    });

    it('handles non-finite coordinates safely', () => {
      const stroke = createMockStroke({ points: [0, 0, 100, 0] });
      expect(isPointHittingStroke(NaN, 0, stroke)).toBe(false);
      expect(isPointHittingStroke(0, Infinity, stroke)).toBe(false);
      expect(isPathHittingStroke(NaN, 0, 100, 0, stroke)).toBe(false);
    });
  });

  describe('determinism', () => {
    it('produces identical hit-testing outcomes across multiple iterations', () => {
      const stroke = createMockStroke({
        points: [10, 10, 50, 80, 120, 30, 200, 150],
      });
      const pointsToTest = [
        { x: 50, y: 80, expected: true },
        { x: 120, y: 30, expected: true },
        { x: 80, y: 55, expected: true },
        { x: 0, y: 0, expected: false },
        { x: 300, y: 300, expected: false },
      ];

      for (let run = 0; run < 10; run++) {
        for (const pt of pointsToTest) {
          expect(isPointHittingStroke(pt.x, pt.y, stroke, 14)).toBe(pt.expected);
        }
      }
    });
  });
});
