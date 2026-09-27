'use client';

import { useRef, useCallback, useEffect } from 'react';
import type Konva from 'konva';
import { stagePointToCanvas } from '../utils/storyboardCoordinates';
import { simplifyStrokePoints } from '../utils/storyboardStrokeUtils';
import type {
  StoryboardViewport,
  StoryboardTool,
  StoryboardStroke,
} from '../types';

export const DEFAULT_PEN_COLOR = '#D97706';
export const DEFAULT_PEN_WIDTH = 3; // screen pixels

export interface UseStoryboardPenOptions {
  activeTool: StoryboardTool;
  viewport: StoryboardViewport;
  readOnly?: boolean;
  penColor?: string;
  penWidth?: number; // screen pixels
  onAddStroke?: (
    points: number[],
    strokeColor: string,
    strokeWidth: number
  ) => Promise<StoryboardStroke | null>;
  onClearSelection?: () => void;
}

export interface UseStoryboardPenReturn {
  isDrawingRef: React.MutableRefObject<boolean>;
  currentPointsRef: React.MutableRefObject<number[]>;
  liveLineRef: React.MutableRefObject<Konva.Line | null>;
  strokesLayerRef: React.MutableRefObject<Konva.Layer | null>;
  handlePenMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  handlePenMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  handlePenMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  cancelDrawing: () => void;
}

/**
 * useStoryboardPen
 *
 * Encapsulates the freehand vector drawing lifecycle for the Storyboard canvas.
 *
 * Performance guarantee:
 * - High-frequency pointermove updates directly mutate the Konva Line ref and
 *   call batchDraw() on the strokes layer.
 * - ZERO React state re-renders occur during drawing.
 * - Points are captured and accumulated in Storyboard world coordinates.
 * - Point simplification (Douglas-Peucker + radial decimation) and world-width
 *   conversion occur exactly once upon pointerup before invoking onAddStroke.
 */
export function useStoryboardPen({
  activeTool,
  viewport,
  readOnly = false,
  penColor = DEFAULT_PEN_COLOR,
  penWidth = DEFAULT_PEN_WIDTH,
  onAddStroke,
  onClearSelection,
}: UseStoryboardPenOptions): UseStoryboardPenReturn {
  const isDrawingRef = useRef<boolean>(false);
  const currentPointsRef = useRef<number[]>([]);
  const liveLineRef = useRef<Konva.Line | null>(null);
  const strokesLayerRef = useRef<Konva.Layer | null>(null);

  // Viewport and options refs to avoid stale closures in event listeners
  const viewportRef = useRef<StoryboardViewport>(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const activeToolRef = useRef<StoryboardTool>(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const readOnlyRef = useRef<boolean>(readOnly);
  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  const penColorRef = useRef<string>(penColor);
  useEffect(() => {
    penColorRef.current = penColor;
  }, [penColor]);

  const penWidthRef = useRef<number>(penWidth);
  useEffect(() => {
    penWidthRef.current = penWidth;
  }, [penWidth]);

  /**
   * Safely cancels any active drawing stroke without persisting.
   * Cleans up live Konva Line and internal refs.
   */
  const cancelDrawing = useCallback(() => {
    if (!isDrawingRef.current && currentPointsRef.current.length === 0) {
      return;
    }

    isDrawingRef.current = false;
    currentPointsRef.current = [];

    const line = liveLineRef.current;
    if (line) {
      line.visible(false);
      line.points([]);
    }

    strokesLayerRef.current?.batchDraw();
  }, []);

  // Cancel drawing whenever user switches away from the 'pen' tool
  useEffect(() => {
    if (activeTool !== 'pen') {
      cancelDrawing();
    }
  }, [activeTool, cancelDrawing]);

  // Global keyboard listener for Escape cancellation and Space pan safety
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Escape' || e.code === 'Space') {
        cancelDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelDrawing]);

  /**
   * PointerDown: Initiate drawing stroke if pen tool is active
   */
  const handlePenMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): boolean => {
      if (activeToolRef.current !== 'pen' || readOnlyRef.current) {
        return false;
      }

      // Ignore middle or right mouse clicks
      if (e.evt.button !== 0) {
        cancelDrawing();
        return false;
      }

      const stage = e.target.getStage();
      if (!stage) return false;

      const pointer = stage.getPointerPosition();
      if (!pointer) return false;

      const vp = viewportRef.current;
      const worldPos = stagePointToCanvas(pointer, vp);

      // Deselect any currently active scene/shots
      onClearSelection?.();

      isDrawingRef.current = true;
      currentPointsRef.current = [worldPos.x, worldPos.y];

      // Convert screen px to world units: worldWidth = penWidth / scale
      const worldWidth = penWidthRef.current / vp.scale;

      const line = liveLineRef.current;
      if (line) {
        // Minimal segment for immediate visual response
        line.points([worldPos.x, worldPos.y, worldPos.x + 0.1, worldPos.y + 0.1]);
        line.stroke(penColorRef.current);
        line.strokeWidth(worldWidth);
        line.lineCap('round');
        line.lineJoin('round');
        line.tension(0);
        line.perfectDrawEnabled(false);
        line.listening(false);
        line.visible(true);
      }

      e.cancelBubble = true;
      strokesLayerRef.current?.batchDraw();
      return true;
    },
    [cancelDrawing, onClearSelection]
  );

  /**
   * PointerMove: Accumulate world coordinates and update live line
   */
  const handlePenMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): boolean => {
      if (activeToolRef.current !== 'pen') {
        return false;
      }

      e.cancelBubble = true;

      if (!isDrawingRef.current) {
        return true;
      }

      const stage = e.target.getStage();
      if (!stage) return true;

      const pointer = stage.getPointerPosition();
      if (!pointer) return true;

      const vp = viewportRef.current;
      const worldPos = stagePointToCanvas(pointer, vp);

      currentPointsRef.current.push(worldPos.x, worldPos.y);

      const line = liveLineRef.current;
      if (line) {
        line.points(currentPointsRef.current);
      }

      strokesLayerRef.current?.batchDraw();
      return true;
    },
    []
  );

  /**
   * PointerUp: Finalize and simplify stroke, then persist through onAddStroke
   */
  const handlePenMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): boolean => {
      if (activeToolRef.current !== 'pen') {
        return false;
      }

      e.cancelBubble = true;

      if (!isDrawingRef.current) {
        return true;
      }

      const rawPoints = [...currentPointsRef.current];
      const vp = viewportRef.current;
      const color = penColorRef.current;
      const worldWidth = penWidthRef.current / vp.scale;

      // Reset drawing state immediately
      isDrawingRef.current = false;
      currentPointsRef.current = [];

      const line = liveLineRef.current;
      if (line) {
        line.visible(false);
        line.points([]);
      }
      strokesLayerRef.current?.batchDraw();

      if (rawPoints.length < 2) {
        return true;
      }

      // Simplify points with tolerance 1.5 world units
      const simplified = simplifyStrokePoints(rawPoints, 1.5);

      if (simplified.length >= 4 && onAddStroke) {
        // Optimistic persistence
        onAddStroke(simplified, color, worldWidth).catch((err) => {
          console.error('Failed to add stroke:', err);
        });
      }

      return true;
    },
    [onAddStroke]
  );

  return {
    isDrawingRef,
    currentPointsRef,
    liveLineRef,
    strokesLayerRef,
    handlePenMouseDown,
    handlePenMouseMove,
    handlePenMouseUp,
    cancelDrawing,
  };
}
