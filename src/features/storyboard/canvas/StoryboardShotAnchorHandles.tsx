'use client';

import React from 'react';
import { Circle } from 'react-konva';
import type Konva from 'konva';
import { CARDINAL_ANCHORS, getShotAnchorPoint } from '../utils/storyboardConnections';
import type { AnchorPosition, StoryboardShotWithLinks, StoryboardTool } from '../types';

export interface StoryboardShotAnchorHandlesProps {
  shot: StoryboardShotWithLinks;
  activeTool: StoryboardTool;
  /** Anchor being snapped to by an incoming drag, for target highlight */
  highlightedAnchor?: AnchorPosition | null;
  onAnchorMouseDown: (
    shotId: string,
    anchor: AnchorPosition,
    worldPoint: { x: number; y: number },
    e: Konva.KonvaEventObject<MouseEvent>
  ) => void;
}

// Visual constants — keep small and cinematic
const ANCHOR_RADIUS = 4.5;         // visible dot radius
const ANCHOR_HIT_RADIUS = 14;      // invisible hit area radius (forgiving)
const ANCHOR_FILL_IDLE = '#38352C';
const ANCHOR_STROKE_IDLE = '#6B6760';
const ANCHOR_FILL_HOVER = '#D97706';
const ANCHOR_STROKE_HOVER = '#F59E0B';
const ANCHOR_FILL_TARGET = '#34D399'; // teal: valid incoming snap target
const ANCHOR_STROKE_TARGET = '#6EE7B7';

/**
 * Renders four cardinal magnetic anchor handles on a Shot Card.
 * Only interactive and visible when ctiveTool === 'connect'.
 *
 * Each anchor uses an oversized invisible hit circle (ANCHOR_HIT_RADIUS)
 * and a small visible dot (ANCHOR_RADIUS) to keep the UI clean while
 * maintaining a generous pick zone.
 *
 * These handles must render ABOVE the ShotCardNode (higher z-order) so they
 * receive pointer events before the card body does.
 */
export function StoryboardShotAnchorHandles({
  shot,
  activeTool,
  highlightedAnchor,
  onAnchorMouseDown,
}: StoryboardShotAnchorHandlesProps) {
  const isConnectTool = activeTool === 'connect';

  // Do not render anything in non-connect modes to avoid polluting other tools
  if (!isConnectTool) return null;

  return (
    <>
      {CARDINAL_ANCHORS.map((anchor) => {
        const pt = getShotAnchorPoint(shot, anchor);
        const isTarget = highlightedAnchor === anchor;

        return (
          <AnchorHandle
            key={anchor}
            x={pt.x}
            y={pt.y}
            anchor={anchor}
            isTarget={isTarget}
            onMouseDown={(e) => onAnchorMouseDown(shot.id, anchor, pt, e)}
          />
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inner stateful handle — manages hover via Konva event handlers
// ---------------------------------------------------------------------------

interface AnchorHandleProps {
  x: number;
  y: number;
  anchor: AnchorPosition;
  isTarget: boolean;
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

function AnchorHandle({ x, y, isTarget, onMouseDown }: AnchorHandleProps) {
  const circleRef = React.useRef<Konva.Circle | null>(null);

  const applyVisual = (hovered: boolean) => {
    const node = circleRef.current;
    if (!node) return;
    if (isTarget) {
      node.fill(ANCHOR_FILL_TARGET);
      node.stroke(ANCHOR_STROKE_TARGET);
      node.radius(ANCHOR_RADIUS + 1.5);
    } else if (hovered) {
      node.fill(ANCHOR_FILL_HOVER);
      node.stroke(ANCHOR_STROKE_HOVER);
      node.radius(ANCHOR_RADIUS + 1);
    } else {
      node.fill(ANCHOR_FILL_IDLE);
      node.stroke(ANCHOR_STROKE_IDLE);
      node.radius(ANCHOR_RADIUS);
    }
    node.getLayer()?.batchDraw();
  };

  // Sync isTarget changes imperatively to avoid stale closure issues
  React.useEffect(() => {
    applyVisual(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTarget]);

  return (
    <>
      {/* Invisible wide hit area */}
      <Circle
        x={x}
        y={y}
        radius={ANCHOR_HIT_RADIUS}
        opacity={0}
        onMouseDown={onMouseDown}
        onMouseEnter={() => applyVisual(true)}
        onMouseLeave={() => applyVisual(false)}
        onMouseEnterCapture={() => {
          if (typeof window !== 'undefined') document.body.style.cursor = 'crosshair';
        }}
        onMouseLeaveCapture={() => {
          if (typeof window !== 'undefined') document.body.style.cursor = 'crosshair';
        }}
      />
      {/* Visible dot */}
      <Circle
        ref={circleRef}
        x={x}
        y={y}
        radius={ANCHOR_RADIUS}
        fill={isTarget ? ANCHOR_FILL_TARGET : ANCHOR_FILL_IDLE}
        stroke={isTarget ? ANCHOR_STROKE_TARGET : ANCHOR_STROKE_IDLE}
        strokeWidth={1}
        listening={false}
        perfectDrawEnabled={false}
        shadowEnabled={false}
      />
    </>
  );
}
