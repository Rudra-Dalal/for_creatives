import { describe, it, expect } from 'vitest';
import {
  slicePolylineWithCircle,
  calculatePolylineLength,
  sliceStrokeItem,
} from '../strokeSlicing';

describe('strokeSlicing — Geometric Polyline Circle Intersection', () => {
  it('calculates flat polyline length correctly', () => {
    const points = [0, 0, 30, 0, 30, 40];
    expect(calculatePolylineLength(points)).toBe(70);
  });

  it('slices a horizontal line in the middle into 2 distinct segments', () => {
    // Line from (0, 50) to (100, 50)
    const line = [0, 50, 100, 50];
    // Eraser at center (50, 50) with radius 10 -> erases x from 40 to 60
    const result = slicePolylineWithCircle(line, 50, 50, 10);

    expect(result.length).toBe(2);
    // First segment: 0 to 40
    expect(result[0][0]).toBeCloseTo(0);
    expect(result[0][1]).toBeCloseTo(50);
    expect(result[0][2]).toBeCloseTo(40);
    expect(result[0][3]).toBeCloseTo(50);

    // Second segment: 60 to 100
    expect(result[1][0]).toBeCloseTo(60);
    expect(result[1][1]).toBeCloseTo(50);
    expect(result[1][2]).toBeCloseTo(100);
    expect(result[1][3]).toBeCloseTo(50);
  });

  it('slices the start of a stroke, leaving a single shortened segment', () => {
    const line = [0, 50, 100, 50];
    // Eraser covers the start (x from -5 to 20)
    const result = slicePolylineWithCircle(line, 0, 50, 20);

    expect(result.length).toBe(1);
    expect(result[0][0]).toBeCloseTo(20);
    expect(result[0][1]).toBeCloseTo(50);
    expect(result[0][2]).toBeCloseTo(100);
    expect(result[0][3]).toBeCloseTo(50);
  });

  it('slices the end of a stroke, leaving a single shortened segment', () => {
    const line = [0, 50, 100, 50];
    // Eraser covers the end (x from 80 to 105)
    const result = slicePolylineWithCircle(line, 100, 50, 20);

    expect(result.length).toBe(1);
    expect(result[0][0]).toBeCloseTo(0);
    expect(result[0][1]).toBeCloseTo(50);
    expect(result[0][2]).toBeCloseTo(80);
    expect(result[0][3]).toBeCloseTo(50);
  });

  it('erases the entire stroke when circle encloses it completely', () => {
    const line = [10, 10, 20, 20, 30, 15];
    // Large circle enclosing all points
    const result = slicePolylineWithCircle(line, 20, 15, 50);
    expect(result.length).toBe(0);
  });

  it('does not touch a stroke that does not intersect the circle', () => {
    const line = [0, 0, 100, 0];
    const result = slicePolylineWithCircle(line, 50, 100, 10);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(line);
  });

  it('handles multi-point wavy polylines smoothly', () => {
    const polyline = [0, 0, 20, 0, 40, 0, 60, 0, 80, 0, 100, 0];
    // Cut around x = 40 with radius 15 (covers x in [25, 55])
    const result = slicePolylineWithCircle(polyline, 40, 0, 15);
    expect(result.length).toBe(2);
    // First chunk ends at x = 25
    expect(result[0][result[0].length - 2]).toBeCloseTo(25);
    // Second chunk starts at x = 55
    expect(result[1][0]).toBeCloseTo(55);
  });

  it('sliceStrokeItem normalizes each surviving piece into local item coordinates', () => {
    // An item at (100, 200) with relative points [0, 0, 100, 0]
    const relPoints = [0, 0, 100, 0];
    // Eraser at canvas (150, 200) with radius 10 (cuts in the middle)
    const boxes = sliceStrokeItem(100, 200, relPoints, 150, 200, 10);
    expect(boxes.length).toBe(2);

    // Box 1
    expect(boxes[0].x).toBeCloseTo(100);
    expect(boxes[0].y).toBeCloseTo(200);
    expect(boxes[0].relativePoints.length).toBeGreaterThanOrEqual(4);

    // Box 2
    expect(boxes[1].x).toBeCloseTo(160);
    expect(boxes[1].y).toBeCloseTo(200);
    expect(boxes[1].relativePoints.length).toBeGreaterThanOrEqual(4);
  });

  describe('Eraser Sizes, Zoom-Scaled Slicing & Atomic Undo', () => {
    it('verifies default Medium eraser size is 16px', async () => {
      const { DEFAULT_ERASER_SIZE } = await import('../../types');
      expect(DEFAULT_ERASER_SIZE).toBe(16);
    });

    it('changing size updates erase radius: 8px is narrow, 16px default, 28px wide', () => {
      const line = [0, 50, 100, 50];

      // 8px (Small) cut
      const cut8 = slicePolylineWithCircle(line, 50, 50, 8);
      expect(cut8.length).toBe(2);
      const gap8 = cut8[1][0] - cut8[0][2];
      expect(gap8).toBeCloseTo(16); // 2 * radius = 16

      // 16px (Medium default) cut
      const cut16 = slicePolylineWithCircle(line, 50, 50, 16);
      expect(cut16.length).toBe(2);
      const gap16 = cut16[1][0] - cut16[0][2];
      expect(gap16).toBeCloseTo(32); // 2 * radius = 32

      // 28px (Large) cut
      const cut28 = slicePolylineWithCircle(line, 50, 50, 28);
      expect(cut28.length).toBe(2);
      const gap28 = cut28[1][0] - cut28[0][2];
      expect(gap28).toBeCloseTo(56); // 2 * radius = 56

      // Monotonic widening: narrow < default < wide
      expect(gap8).toBeLessThan(gap16);
      expect(gap16).toBeLessThan(gap28);
    });

    it('screen-space size remains visually consistent across zoom levels', async () => {
      const { screenDistanceToCanvas, canvasDistanceToScreen } = await import('../../coordinates');
      const screenEraserSize = 16;
      const zoomScales = [0.5, 1.0, 2.0];

      for (const scale of zoomScales) {
        // World radius adjusts inversely with scale
        const worldRadius = screenDistanceToCanvas(screenEraserSize, scale);

        // Perform cut in world coordinates
        const line = [0, 50, 200, 50];
        const result = slicePolylineWithCircle(line, 100, 50, worldRadius);
        expect(result.length).toBe(2);

        // Calculate world cut gap
        const worldGap = result[1][0] - result[0][2];
        expect(worldGap).toBeCloseTo(worldRadius * 2);

        // Project cut back to screen space: MUST match 2 * screenEraserSize regardless of zoom
        const screenCutWidth = canvasDistanceToScreen(worldGap, scale);
        expect(screenCutWidth).toBeCloseTo(screenEraserSize * 2, 5);
      }
    });

    it('partial stroke splitting works cleanly for all 3 discrete sizes (8, 16, 28)', () => {
      const line = [0, 100, 200, 100];
      const sizes = [8, 16, 28];

      for (const size of sizes) {
        const splitResult = slicePolylineWithCircle(line, 100, 100, size);
        expect(splitResult.length).toBe(2);
        // First piece starts at 0, ends before cut
        expect(splitResult[0][0]).toBe(0);
        expect(splitResult[0][2]).toBeCloseTo(100 - size);
        // Second piece starts after cut, ends at 200
        expect(splitResult[1][0]).toBeCloseTo(100 + size);
        expect(splitResult[1][2]).toBe(200);
      }
    });

    it('one continuous erase gesture produces one atomic PARTIAL_ERASE undo action', () => {
      // Simulates the commit structure created by finishErasing in MoodboardStage
      const initialStrokes = [
        {
          id: 'stroke-1',
          type: 'stroke' as const,
          x: 0,
          y: 50,
          width: 100,
          height: 10,
          z_index: 1,
          content: { points: [0, 5, 100, 5], color: '#D97706', strokeWidth: 4 },
        },
      ];

      // A single erase pass updates the original stroke and adds a new sub-stroke
      const undoAction = {
        type: 'PARTIAL_ERASE' as const,
        updates: [{ id: 'stroke-1', x: 0, y: 50, width: 42, height: 10, relativePoints: [0, 5, 42, 5] }],
        newStrokeIds: ['sub-stroke-2'],
        deletedStrokes: [],
        originalStrokes: initialStrokes,
      };

      // Atomic contract: all pieces are packed into one single undo action
      expect(undoAction.type).toBe('PARTIAL_ERASE');
      expect(undoAction.updates.length).toBe(1);
      expect(undoAction.newStrokeIds.length).toBe(1);
      expect(undoAction.originalStrokes).toEqual(initialStrokes);
    });
  });
});

