'use client';

import { useState, useRef, useCallback } from 'react';
import type Konva from 'konva';
import type {
  StoryboardShotWithLinks,
  StoryboardViewport,
  StoryboardBounds,
  StoryboardPoint,
  StoryboardTool,
} from '../types';
import { stagePointToCanvas, CLICK_VS_DRAG_THRESHOLD_PX } from '../utils/storyboardCoordinates';
import { findIntersectingShots } from '../utils/storyboardGeometry';

export interface UseStoryboardMarqueeOptions {
  allShots: StoryboardShotWithLinks[];
  viewport: StoryboardViewport;
  activeTool: StoryboardTool;
  readOnly?: boolean;
  selectedShotIds: Set<string>;
  onSelectShots: (ids: Set<string>) => void;
  onClearSceneSelection?: () => void;
}

export interface UseStoryboardMarqueeReturn {
  marqueeBounds: StoryboardBounds | null;
  isMarqueeActive: boolean;
  handleStageMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleStageMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleStageMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  cancelMarquee: () => void;
}

/**
 * Manages rubber-band marquee selection for the storyboard canvas.
 *
 * Invariants:
 * - Initiates only on empty canvas mousedown (when e.target is Stage or background Layer).
 * - Only left mouse button (button 0) initiates marquee — middle/right click are ignored.
 * - Active tool must be 'select' (pen, eraser, and connect tools take full precedence).
 * - Enforces CLICK_VS_DRAG_THRESHOLD_PX (4px) before activating the marquee box to avoid accidental triggers on simple clicks.
 * - Computes AABB bounding-box intersection against all shots.
 * - Supports Shift/Cmd/Ctrl modifiers for additive multi-selection.
 * - Real-time selection updates during drag for immediate visual feedback.
 * - Clean cancellation on Escape.
 */
export function useStoryboardMarquee({
  allShots,
  viewport,
  activeTool,
  readOnly = false,
  selectedShotIds,
  onSelectShots,
  onClearSceneSelection,
}: UseStoryboardMarqueeOptions): UseStoryboardMarqueeReturn {
  const [marqueeBounds, setMarqueeBounds] = useState<StoryboardBounds | null>(null);
  const isMarqueeSelectingRef = useRef<boolean>(false);
  const marqueeStartPointRef = useRef<StoryboardPoint | null>(null);
  const marqueeBoundsRef = useRef<StoryboardBounds | null>(null);
  const initialSelectedShotIdsRef = useRef<Set<string>>(new Set());

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (readOnly || activeTool !== 'select') return;

      // Only left mouse button (button 0) initiates marquee
      if ('button' in e.evt && e.evt.button !== 0) return;

      const stage = e.target.getStage();
      if (!stage) return;

      // Must start on empty background
      const isBackground =
        e.target === stage ||
        e.target.name() === 'storyboard-background-layer' ||
        e.target.name() === 'storyboard-objects-layer';

      if (!isBackground) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldPos = stagePointToCanvas(pointer, viewport);

      isMarqueeSelectingRef.current = true;
      marqueeStartPointRef.current = worldPos;
      marqueeBoundsRef.current = null;

      const isAdditive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
      initialSelectedShotIdsRef.current = isAdditive ? new Set(selectedShotIds) : new Set();

      if (!isAdditive && onClearSceneSelection) {
        onClearSceneSelection();
      }
    },
    [readOnly, activeTool, viewport, selectedShotIds, onClearSceneSelection]
  );

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isMarqueeSelectingRef.current || !marqueeStartPointRef.current) return;

      const stage = e.target.getStage();
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldPos = stagePointToCanvas(pointer, viewport);
      const start = marqueeStartPointRef.current;

      const dx = Math.abs(worldPos.x - start.x);
      const dy = Math.abs(worldPos.y - start.y);

      // Require movement exceeding threshold before activating marquee
      if (
        dx < CLICK_VS_DRAG_THRESHOLD_PX &&
        dy < CLICK_VS_DRAG_THRESHOLD_PX &&
        !marqueeBoundsRef.current
      ) {
        return;
      }

      const bounds: StoryboardBounds = {
        x: Math.min(start.x, worldPos.x),
        y: Math.min(start.y, worldPos.y),
        width: dx,
        height: dy,
      };

      marqueeBoundsRef.current = bounds;
      setMarqueeBounds(bounds);

      // AABB intersection calculation
      const hitIds = findIntersectingShots(allShots, bounds);
      const isAdditive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
      const nextSelection = isAdditive
        ? new Set([...initialSelectedShotIdsRef.current, ...hitIds])
        : new Set(hitIds);

      onSelectShots(nextSelection);
    },
    [allShots, viewport, onSelectShots]
  );

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isMarqueeSelectingRef.current) return;

      if (marqueeBoundsRef.current) {
        const hitIds = findIntersectingShots(allShots, marqueeBoundsRef.current);
        const isAdditive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
        const nextSelection = isAdditive
          ? new Set([...initialSelectedShotIdsRef.current, ...hitIds])
          : new Set(hitIds);

        onSelectShots(nextSelection);
      }

      isMarqueeSelectingRef.current = false;
      marqueeStartPointRef.current = null;
      marqueeBoundsRef.current = null;
      setMarqueeBounds(null);
    },
    [allShots, onSelectShots]
  );

  const cancelMarquee = useCallback(() => {
    isMarqueeSelectingRef.current = false;
    marqueeStartPointRef.current = null;
    marqueeBoundsRef.current = null;
    setMarqueeBounds(null);
  }, []);

  return {
    get marqueeBounds() {
      return marqueeBounds ?? marqueeBoundsRef.current;
    },
    get isMarqueeActive() {
      const b = marqueeBounds ?? marqueeBoundsRef.current;
      return Boolean(b && (b.width > 0 || b.height > 0));
    },
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    cancelMarquee,
  };
}
