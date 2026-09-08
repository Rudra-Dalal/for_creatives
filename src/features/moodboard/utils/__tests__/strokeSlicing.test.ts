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

  it('correctly scales cut radius for different eraser sizes (8, 16, 28)', () => {
    const line = [0, 50, 100, 50];

    // Fine eraser: radius 8 (cut zone [42, 58])
    const cut8 = slicePolylineWithCircle(line, 50, 50, 8);
    expect(cut8.length).toBe(2);
    expect(cut8[0][2]).toBeCloseTo(42);
    expect(cut8[1][0]).toBeCloseTo(58);

    // Medium eraser: radius 16 (cut zone [34, 66])
    const cut16 = slicePolylineWithCircle(line, 50, 50, 16);
    expect(cut16.length).toBe(2);
    expect(cut16[0][2]).toBeCloseTo(34);
    expect(cut16[1][0]).toBeCloseTo(66);

    // Large eraser: radius 28 (cut zone [22, 78])
    const cut28 = slicePolylineWithCircle(line, 50, 50, 28);
    expect(cut28.length).toBe(2);
    expect(cut28[0][2]).toBeCloseTo(22);
    expect(cut28[1][0]).toBeCloseTo(78);
  });
});

