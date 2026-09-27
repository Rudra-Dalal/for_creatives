'use client';

import React from 'react';
import { Line } from 'react-konva';
import type { StoryboardStroke } from '../types';

export interface StoryboardStrokeNodeProps {
  stroke: StoryboardStroke;
}

/**
 * Validates and extracts a flat array of numbers [x0, y0, x1, y1, ...]
 * from a stroke's raw points field (which is typed as Json in database types).
 *
 * Requirements:
 * - Must be an array (or parseable JSON array)
 * - Must have an even length (pairs of coordinates)
 * - Must have at least 2 points (4 coordinates: [x0, y0, x1, y1])
 * - All items must be finite numbers (no NaN, Infinity, strings, etc.)
 */
export function getValidStrokePoints(rawPoints: unknown): number[] | null {
  if (!rawPoints) return null;

  let points: unknown = rawPoints;
  if (typeof rawPoints === 'string') {
    try {
      points = JSON.parse(rawPoints);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(points)) return null;

  if (points.length < 4 || points.length % 2 !== 0) {
    return null;
  }

  for (let i = 0; i < points.length; i++) {
    const val = points[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return null;
    }
  }

  return points as number[];
}

/**
 * StoryboardStrokeNode
 *
 * Renders a single persisted freehand vector annotation stroke on the Storyboard Konva canvas.
 * Points and stroke width are already stored in world coordinates — no transformations
 * or coordinate shifts should be applied here.
 *
 * Non-interactive: `listening={false}` ensures pointer events pass through to objects below.
 * Robustness: Malformed or soft-deleted strokes safely return null to prevent canvas crashes.
 */
export function StoryboardStrokeNodeComponent({
  stroke,
}: StoryboardStrokeNodeProps) {
  // Defense-in-depth: skip soft-deleted strokes
  if (stroke.deleted_at) {
    return null;
  }

  // Validate points array
  const points = getValidStrokePoints(stroke.points);
  if (!points) {
    return null;
  }

  // Validate stroke_width: must be a positive finite number
  if (
    typeof stroke.stroke_width !== 'number' ||
    !Number.isFinite(stroke.stroke_width) ||
    stroke.stroke_width <= 0
  ) {
    return null;
  }

  // Validate stroke_color: must be a non-empty string
  if (typeof stroke.stroke_color !== 'string' || !stroke.stroke_color.trim()) {
    return null;
  }

  return (
    <Line
      id={`storyboard-stroke-${stroke.id}`}
      name="storyboard-stroke"
      points={points}
      stroke={stroke.stroke_color}
      strokeWidth={stroke.stroke_width}
      lineCap="round"
      lineJoin="round"
      tension={0}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
}

export const StoryboardStrokeNode = React.memo(StoryboardStrokeNodeComponent);
