import { useRef, useCallback, useEffect } from 'react';
import type Konva from 'konva';
import type { StoryboardStroke, StoryboardViewport } from '../types';
import { stagePointToCanvas } from '../utils/storyboardCoordinates';
import { isPathHittingStroke } from '../utils/storyboardStrokeUtils';

export const DEFAULT_ERASER_HIT_RADIUS = 14;

export interface UseStoryboardEraserOptions {
  activeTool: string;
  viewport: StoryboardViewport;
  strokes: StoryboardStroke[];
  readOnly?: boolean;
  hitRadius?: number;
  onEraseStroke?: (id: string) => Promise<boolean>;
  onEraseGestureComplete?: (erasedStrokeIds: string[]) => void;
  onClearSelection?: () => void;
}

export interface UseStoryboardEraserReturn {
  isErasingRef: React.MutableRefObject<boolean>;
  prevPointerPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  erasedStrokeIdsRef: React.MutableRefObject<Set<string>>;
  handleEraserMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  handleEraserMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  handleEraserMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  cancelErasing: () => void;
}

/**
 * useStoryboardEraser
 *
 * Owns the Storyboard whole-stroke contact eraser interaction.
 *
 * Core specifications:
 * - Activates when activeTool === 'eraser' and !readOnly
 * - Uses isPathHittingStroke to test contact between previous and current world pointer positions
 * - Evaluates swept path so fast sweeps do not jump across thin strokes
 * - Whole-stroke semantics: touches any portion -> deletes the entire stroke
 * - Optimistic deletion via onEraseStroke(strokeId)
 * - Safe repeat-erase prevention: erases at most one stroke per pointermove event
 * - Tracks in-flight erased stroke IDs so rapid pointermoves do not re-delete before React re-render
 * - Bypasses React state during pointermove to eliminate render thrashing
 * - Escape / Spacebar / tool switch cleanly cancels any active eraser gesture
 */
export function useStoryboardEraser({
  activeTool,
  viewport,
  strokes,
  readOnly = false,
  hitRadius = DEFAULT_ERASER_HIT_RADIUS,
  onEraseStroke,
  onEraseGestureComplete,
  onClearSelection,
}: UseStoryboardEraserOptions): UseStoryboardEraserReturn {
  const isErasingRef = useRef<boolean>(false);
  const prevPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const erasedStrokeIdsRef = useRef<Set<string>>(new Set());
  const gestureErasedIdsRef = useRef<string[]>([]);

  // Mutable refs for latest values without breaking memoization
  const viewportRef = useRef<StoryboardViewport>(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const strokesRef = useRef<StoryboardStroke[]>(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
    // Clean up IDs of strokes no longer present in active state
    const currentIds = new Set(strokes.map((s) => s.id));
    for (const id of erasedStrokeIdsRef.current) {
      if (!currentIds.has(id)) {
        erasedStrokeIdsRef.current.delete(id);
      }
    }
  }, [strokes]);

  const activeToolRef = useRef<string>(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  const readOnlyRef = useRef<boolean>(readOnly);
  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  const onEraseStrokeRef = useRef(onEraseStroke);
  useEffect(() => {
    onEraseStrokeRef.current = onEraseStroke;
  }, [onEraseStroke]);

  const onEraseGestureCompleteRef = useRef(onEraseGestureComplete);
  useEffect(() => {
    onEraseGestureCompleteRef.current = onEraseGestureComplete;
  }, [onEraseGestureComplete]);

  /**
   * Safely cancels any active eraser gesture without deleting further strokes.
   */
  const cancelErasing = useCallback(() => {
    isErasingRef.current = false;
    prevPointerPosRef.current = null;
    gestureErasedIdsRef.current = [];
  }, []);

  // Cancel eraser gesture on tool switch
  useEffect(() => {
    if (activeTool !== 'eraser') {
      cancelErasing();
    }
  }, [activeTool, cancelErasing]);

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
        cancelErasing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelErasing]);

  /**
   * PointerDown: Initiate eraser gesture if eraser tool is active.
   * Does NOT delete anything on pointerdown.
   */
  const handleEraserMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): boolean => {
      if (activeToolRef.current !== 'eraser' || readOnlyRef.current) {
        return false;
      }

      // Ignore middle or right mouse clicks
      if (e.evt.button !== 0) {
        cancelErasing();
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

      isErasingRef.current = true;
      prevPointerPosRef.current = { x: worldPos.x, y: worldPos.y };
      gestureErasedIdsRef.current = [];

      e.cancelBubble = true;
      return true;
    },
    [cancelErasing, onClearSelection]
  );

  /**
   * PointerMove: Evaluate swept eraser path and erase at most one stroke per event.
   */
  const handleEraserMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): boolean => {
      if (activeToolRef.current !== 'eraser') {
        return false;
      }

      e.cancelBubble = true;

      if (!isErasingRef.current || !prevPointerPosRef.current || readOnlyRef.current) {
        return true;
      }

      const stage = e.target.getStage();
      if (!stage) return true;

      const pointer = stage.getPointerPosition();
      if (!pointer) return true;

      const vp = viewportRef.current;
      const worldPos = stagePointToCanvas(pointer, vp);
      const prevPos = prevPointerPosRef.current;

      // Filter active strokes, skipping soft-deleted or already erased strokes
      const activeStrokes = strokesRef.current.filter(
        (s) => !s.deleted_at && !erasedStrokeIdsRef.current.has(s.id)
      );

      // Preferred V1: erase at most one stroke per movement event
      for (const stroke of activeStrokes) {
        const isHit = isPathHittingStroke(
          prevPos.x,
          prevPos.y,
          worldPos.x,
          worldPos.y,
          stroke,
          hitRadius
        );

        if (isHit) {
          const strokeId = stroke.id;
          erasedStrokeIdsRef.current.add(strokeId);
          if (!gestureErasedIdsRef.current.includes(strokeId)) {
            gestureErasedIdsRef.current.push(strokeId);
          }
          onEraseStrokeRef.current?.(strokeId)
            .then((success) => {
              if (success === false) {
                erasedStrokeIdsRef.current.delete(strokeId);
                gestureErasedIdsRef.current = gestureErasedIdsRef.current.filter((id) => id !== strokeId);
              }
            })
            .catch((err) => {
              console.error('Failed to erase stroke:', err);
              erasedStrokeIdsRef.current.delete(strokeId);
              gestureErasedIdsRef.current = gestureErasedIdsRef.current.filter((id) => id !== strokeId);
            });

          break; // Stop after erasing one stroke per movement event
        }
      }

      prevPointerPosRef.current = { x: worldPos.x, y: worldPos.y };
      return true;
    },
    [hitRadius]
  );

  /**
   * PointerUp: Finalize and end eraser gesture.
   */
  const handleEraserMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): boolean => {
      if (activeToolRef.current !== 'eraser') {
        return false;
      }

      e.cancelBubble = true;
      isErasingRef.current = false;
      prevPointerPosRef.current = null;

      if (gestureErasedIdsRef.current.length > 0) {
        onEraseGestureCompleteRef.current?.([...gestureErasedIdsRef.current]);
        gestureErasedIdsRef.current = [];
      }

      return true;
    },
    []
  );

  return {
    isErasingRef,
    prevPointerPosRef,
    erasedStrokeIdsRef,
    handleEraserMouseDown,
    handleEraserMouseMove,
    handleEraserMouseUp,
    cancelErasing,
  };
}
