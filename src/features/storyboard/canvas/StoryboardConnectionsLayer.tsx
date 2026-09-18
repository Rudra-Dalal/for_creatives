'use client';

/**
 * StoryboardConnectionsLayer
 *
 * Renders the full set of persisted sequence connections plus an optional
 * live Bézier preview during connection drag.
 *
 * Live preview:
 *  - During drag, dragState is non-null and contains the preview endpoint.
 *  - A synthetic "from" shot + a synthetic "to" stub are computed from the
 *    drag state to drive StoryboardConnectionLine in preview mode.
 *  - The preview renders directly from the dragStateRef to avoid React
 *    re-renders on every pointer move. Instead the parent (StoryboardCanvas)
 *    calls a provided invalidate() callback on each move to force a
 *    single layer batchDraw.
 *
 * Live follow:
 *  - All positions are read from llShots (React state, updated after dragEnd).
 *  - During a shot drag, Konva moves the shot node imperatively; the
 *    connection lines do not update until the drag commits. This is the
 *    same trade-off used by all Konva-based canvas editors to maintain 60fps.
 */

import React, { useRef, useCallback } from 'react';
import { Layer, Shape } from 'react-konva';
import type Konva from 'konva';
import { StoryboardConnectionLine } from './StoryboardConnectionLine';
import {
  getShotAnchorPoint,
  calculateSequenceBezierCurve,
} from '../utils/storyboardConnections';
import type { ConnectionDragState } from './useConnectionDrag';
import type { StoryboardShotConnection, StoryboardShotWithLinks } from '../types';

export interface StoryboardConnectionsLayerProps {
  connections: StoryboardShotConnection[];
  allShots: StoryboardShotWithLinks[];
  /** Read by the layer on every frame — no React state update needed */
  dragStateRef: React.MutableRefObject<ConnectionDragState | null>;
  /** Call this to trigger a batchDraw of the layer during drag */
  onRegisterLayerRef?: (layer: Konva.Layer | null) => void;
}

/**
 * Preview line colors
 */
const PREVIEW_STROKE = '#D97706';
const PREVIEW_FILL = '#D97706';

export function StoryboardConnectionsLayer({
  connections,
  allShots,
  dragStateRef,
  onRegisterLayerRef,
}: StoryboardConnectionsLayerProps) {
  const layerRef = useRef<Konva.Layer | null>(null);
  const previewShapeRef = useRef<Konva.Shape | null>(null);

  // Build an id→shot lookup for fast O(1) access
  const shotMap = React.useMemo(() => {
    const m = new Map<string, StoryboardShotWithLinks>();
    for (const s of allShots) m.set(s.id, s);
    return m;
  }, [allShots]);

  const handleLayerRef = useCallback(
    (node: Konva.Layer | null) => {
      layerRef.current = node;
      onRegisterLayerRef?.(node);
    },
    [onRegisterLayerRef]
  );

  /**
   * Preview Shape scene function — called by Konva on every batchDraw.
   * Reads dragStateRef.current directly (no React state).
   */
  const renderPreview = useCallback(
    (ctx: Konva.Context, shape: Konva.Shape) => {
      const drag = dragStateRef.current;
      if (!drag?.active) {
        // Nothing to draw; clear the shape
        ctx.clearRect(
          -shape.x(),
          -shape.y(),
          shape.getLayer()?.width() ?? 10000,
          shape.getLayer()?.height() ?? 10000
        );
        return;
      }

      const fromShot = shotMap.get(drag.fromShotId);
      if (!fromShot) return;

      const start = getShotAnchorPoint(fromShot, drag.fromAnchor);
      const end = drag.previewEnd;

      // Use the snap target anchor if available, otherwise treat end as 'left'
      const toAnchor = drag.snapTarget?.anchor ?? 'left';
      const curve = calculateSequenceBezierCurve(start, end, drag.fromAnchor, toAnchor);
      const { controlPoint1: cp1, controlPoint2: cp2 } = curve;

      // Draw Bézier curve
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);

      const kctx = ctx as unknown as CanvasRenderingContext2D;
      kctx.strokeStyle = PREVIEW_STROKE;
      kctx.lineWidth = 1.5;
      kctx.globalAlpha = 0.85;
      kctx.setLineDash([5, 4]);
      ctx.stroke();
      kctx.setLineDash([]);
      kctx.globalAlpha = 1;

      // Draw arrowhead
      const tangentX = end.x - cp2.x;
      const tangentY = end.y - cp2.y;
      const tLen = Math.hypot(tangentX, tangentY) || 1;
      const nx = tangentX / tLen;
      const ny = tangentY / tLen;
      const headLen = 9;
      const angle = 0.45; // radians

      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLen * (nx * Math.cos(angle) - ny * Math.sin(angle)),
        end.y - headLen * (ny * Math.cos(angle) + nx * Math.sin(angle))
      );
      ctx.lineTo(
        end.x - headLen * (nx * Math.cos(-angle) - ny * Math.sin(-angle)),
        end.y - headLen * (ny * Math.cos(-angle) + nx * Math.sin(-angle))
      );
      ctx.closePath();
      kctx.fillStyle = PREVIEW_FILL;
      ctx.fill();
    },
    [dragStateRef, shotMap]
  );

  return (
    <Layer ref={handleLayerRef} name="storyboard-connections-layer" listening={false}>
      {/* Persisted connection arrows */}
      {connections.map((conn) => {
        const fromShot = shotMap.get(conn.from_shot_id);
        const toShot = shotMap.get(conn.to_shot_id);
        if (!fromShot || !toShot) return null;

        return (
          <StoryboardConnectionLine
            key={conn.id}
            id={conn.id}
            fromShot={fromShot}
            toShot={toShot}
            fromAnchor={conn.from_anchor as import('../types').AnchorPosition}
            toAnchor={conn.to_anchor as import('../types').AnchorPosition}
          />
        );
      })}

      {/* Live preview — always mounted, renders nothing when drag is inactive */}
      <Shape
        ref={previewShapeRef}
        sceneFunc={renderPreview}
        listening={false}
        perfectDrawEnabled={false}
        // Occupy the full layer space so clearRect covers previous frames
        x={0}
        y={0}
        width={1}
        height={1}
      />
    </Layer>
  );
}
