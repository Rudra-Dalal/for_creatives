'use client';

import { useRef, useCallback } from 'react';
import type Konva from 'konva';
import { getPointerCanvasPosition, screenDistanceToCanvas } from '../coordinates/canvasCoordinates';
import type { ViewportTransform } from '../coordinates/geometryTypes';
import { simplifyPoints, normalizeStrokePoints } from '../utils/strokeUtils';

export interface UsePenToolOptions {
  /** Konva Stage ref for pointer position and transform calculation. */
  stageRef: React.RefObject<Konva.Stage | null>;
  /** Active canvas tool: only 'pen' initiates or processes strokes. */
  activeTool?: 'select' | 'pen' | 'eraser';
  /** Whether canvas is in read-only mode (blocks all pen mutations). */
  readOnly?: boolean;
  /** Stroke color hex (e.g. #D97706). */
  penColor?: string;
  /** Stroke strokeWidth in canvas units (2, 4, 8). */
  penWidth?: number;
  /** Current viewport for fallback coordinate calculations. */
  viewport?: ViewportTransform;
  /** Callback to persist the committed stroke on pointer up. */
  onAddStroke?: (
    relativePoints: number[],
    color: string,
    width: number,
    bounds: { x: number; y: number; width: number; height: number }
  ) => void;
  /** Optional callback to deselect any active items when starting a new stroke. */
  onClearSelection?: () => void;
}

export interface UsePenToolReturn {
  /** Konva Line ref for the in-progress live stroke. */
  activeLineRef: React.RefObject<Konva.Line>;
  /** Ref indicating whether a drawing gesture is currently in progress. */
  isDrawingRef: React.MutableRefObject<boolean>;
  /** Handles pointer down on the canvas to begin a pen stroke. Returns true if handled. */
  handleStageMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => boolean;
  /** Handles pointer move on the canvas to mutate the live Konva Line directly. Returns true if handled. */
  handleStageMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => boolean;
  /** Handles pointer up to finalize, simplify, normalize, and commit the stroke. Returns true if handled. */
  handleStageMouseUp: () => boolean;
}

/**
 * usePenTool — High-performance authoritative controller for freehand pen interaction.
 *
 * Performance Contract:
 *  1. Pointermove events NEVER trigger React state updates or React re-renders.
 *  2. Konva Line points are mutated directly on the node via activeLineRef.
 *  3. Redraws are confined strictly to the dedicated drawing Layer via drawingLayer.batchDraw(),
 *     completely bypassing the heavy items/cards/background layers.
 *  4. Live in-progress line uses linear segments (tension = 0) to eliminate expensive
 *     per-frame Catmull-Rom spline calculations across hundreds of points.
 *  5. Douglas-Peucker point simplification and bounding box normalization run ONLY once
 *     on pointer up during commit.
 */
export function usePenTool({
  stageRef,
  activeTool = 'select',
  readOnly = false,
  penColor = '#D97706',
  penWidth = 4,
  viewport,
  onAddStroke,
  onClearSelection,
}: UsePenToolOptions): UsePenToolReturn {
  const isDrawingRef = useRef<boolean>(false);
  const currentStrokePointsRef = useRef<number[]>([]);
  const activeLineRef = useRef<Konva.Line>(null as unknown as Konva.Line);

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): boolean => {
      // Ignore middle-click panning or non-pen tools or read-only mode
      if ('button' in e.evt && e.evt.button === 1) return false;
      if (readOnly || activeTool !== 'pen') return false;

      const stage = stageRef.current;
      if (!stage) return false;

      const pos = getPointerCanvasPosition(stage, viewport);
      if (!pos) return false;

      isDrawingRef.current = true;
      currentStrokePointsRef.current = [pos.x, pos.y];

      if (activeLineRef.current) {
        const canvasWidth = screenDistanceToCanvas(penWidth, viewport?.scale ?? 1);
        activeLineRef.current.points([pos.x, pos.y]);
        activeLineRef.current.stroke(penColor);
        activeLineRef.current.strokeWidth(canvasWidth);
        activeLineRef.current.visible(true);
        activeLineRef.current.getLayer()?.batchDraw();
      }

      // Clear selection without delaying stroke initiation
      if (onClearSelection) {
        onClearSelection();
      }

      return true;
    },
    [readOnly, activeTool, stageRef, viewport, penColor, penWidth, onClearSelection]
  );

  const handleStageMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): boolean => {
      if (!isDrawingRef.current) return false;

      const stage = stageRef.current;
      if (!stage) return false;

      const pos = getPointerCanvasPosition(stage, viewport);
      if (!pos) return false;

      // Direct point accumulation into flat array [x0, y0, x1, y1, ...]
      currentStrokePointsRef.current.push(pos.x, pos.y);

      // Direct Konva node mutation — 0 React re-renders, 60-120fps fluid response
      if (activeLineRef.current) {
        activeLineRef.current.points(currentStrokePointsRef.current);
        activeLineRef.current.getLayer()?.batchDraw();
      }

      return true;
    },
    [stageRef, viewport]
  );

  const handleStageMouseUp = useCallback((): boolean => {
    if (!isDrawingRef.current) return false;

    isDrawingRef.current = false;
    const rawPoints = currentStrokePointsRef.current;
    currentStrokePointsRef.current = [];

    // Immediately hide and clear the live line on the dedicated drawing layer
    if (activeLineRef.current) {
      activeLineRef.current.visible(false);
      activeLineRef.current.points([]);
      activeLineRef.current.getLayer()?.batchDraw();
    }

    // Run simplification and normalization ONLY at commit phase
    if (rawPoints && rawPoints.length >= 2 && onAddStroke) {
      // Douglas-Peucker point reduction (tolerance: 1.5px)
      const simplified = simplifyPoints(rawPoints, 1.5);
      // Compute bounding box and relative points
      const bbox = normalizeStrokePoints(simplified);

      const canvasWidth = screenDistanceToCanvas(penWidth, viewport?.scale ?? 1);
      onAddStroke(bbox.relativePoints, penColor, canvasWidth, {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
    }

    return true;
  }, [onAddStroke, penColor, penWidth, viewport]);

  return {
    activeLineRef,
    isDrawingRef,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
  };
}
