'use client';

import React from 'react';
import { Shape, Arrow } from 'react-konva';
import type Konva from 'konva';
import {
  getShotAnchorPoint,
  calculateSequenceBezierCurve,
} from '../utils/storyboardConnections';
import type { AnchorPosition, StoryboardShotWithLinks } from '../types';

export interface StoryboardConnectionLineProps {
  /** The connection id (used as Konva node key/id) */
  id: string;
  fromShot: StoryboardShotWithLinks;
  toShot: StoryboardShotWithLinks;
  fromAnchor: AnchorPosition;
  toAnchor: AnchorPosition;
  /** Screen-space pointer position override; used only for live preview */
  previewEnd?: { x: number; y: number } | null;
  isPreview?: boolean;
}

// Cinematic neutral palette — warm dark, one amber accent
const CONNECTION_STROKE = '#4A463D';        // quiet warm neutral for persisted lines
const CONNECTION_STROKE_PREVIEW = '#D97706'; // amber accent during live drag
const ARROW_FILL = '#4A463D';
const ARROW_FILL_PREVIEW = '#D97706';

const STROKE_WIDTH = 1.5;
const HIT_STROKE_WIDTH = 12; // wide invisible hit envelope for future selection

/**
 * Renders a single directed sequence connection as a cubic Bézier arrow.
 *
 * Geometry is delegated entirely to the storyboardConnections utilities —
 * no anchor math lives here.
 *
 * Layer expectation: render BELOW ShotCardNode children in the same Konva
 * Layer so that shot cards always paint on top.
 */
export const StoryboardConnectionLine = React.memo(function StoryboardConnectionLine({
  id,
  fromShot,
  toShot,
  fromAnchor,
  toAnchor,
  isPreview = false,
}: StoryboardConnectionLineProps) {
  const start = getShotAnchorPoint(fromShot, fromAnchor);
  const end = getShotAnchorPoint(toShot, toAnchor);
  const curve = calculateSequenceBezierCurve(start, end, fromAnchor, toAnchor);

  const stroke = isPreview ? CONNECTION_STROKE_PREVIEW : CONNECTION_STROKE;
  const fill = isPreview ? ARROW_FILL_PREVIEW : ARROW_FILL;

  // Arrow expects a flat [x0, y0, ... x1, y1] array where the LAST two
  // values are the endpoint — it draws a straight line between all points
  // but we want a Bézier. We therefore render the curved path via Shape
  // and the arrowhead as a tiny Arrow starting 1px before the tip.
  const { controlPoint1: cp1, controlPoint2: cp2 } = curve;

  // Calculate the arrowhead direction from the tangent at t≈1
  // Tangent at end = 3*(end - cp2)
  const tangentX = end.x - cp2.x;
  const tangentY = end.y - cp2.y;
  const tangentLen = Math.hypot(tangentX, tangentY) || 1;
  const normX = tangentX / tangentLen;
  const normY = tangentY / tangentLen;
  // Place arrowhead tail 12px back along the tangent
  const arrowTailX = end.x - normX * 12;
  const arrowTailY = end.y - normY * 12;

  const sceneFunc = (ctx: Konva.Context) => {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
    ctx.stroke();
  };

  return (
    <>
      {/* Bézier curve path — drawn via Shape for cubic control */}
      <Shape
        id={`conn-curve-${id}`}
        sceneFunc={sceneFunc}
        stroke={stroke}
        strokeWidth={STROKE_WIDTH}
        opacity={isPreview ? 0.9 : 0.75}
        hitStrokeWidth={HIT_STROKE_WIDTH}
        listening={false}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />

      {/* Arrowhead — tiny Arrow in the tangent direction at the endpoint */}
      <Arrow
        id={`conn-arrow-${id}`}
        points={[arrowTailX, arrowTailY, end.x, end.y]}
        pointerLength={8}
        pointerWidth={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_WIDTH}
        opacity={isPreview ? 0.9 : 0.75}
        listening={false}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    </>
  );
});
