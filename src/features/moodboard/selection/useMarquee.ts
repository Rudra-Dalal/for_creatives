'use client';

import { useState, useRef, useCallback } from 'react';
import type Konva from 'konva';
import { CLICK_VS_DRAG_THRESHOLD_PX } from '../coordinates';
import type { MarqueeBox, UseMarqueeOptions, UseMarqueeReturn } from './selectionTypes';

/**
 * Manages marquee selection box geometry, threshold activation, and item intersection testing.
 *
 * Invariants:
 * - Initiates only on empty canvas mousedown (when e.target is Stage or background Layer).
 * - Enforces the authoritative CLICK_VS_DRAG_THRESHOLD_PX (4px) before displaying the box or selecting.
 * - Computes clean axis-aligned bounding box (AABB) intersection against all canvas items.
 * - Supports Shift-drag for additive multi-selection.
 */
export function useMarquee({
  items,
  viewport,
  stageRef,
  onSelectIds,
  selectedIds,
  enabled = true,
}: UseMarqueeOptions): UseMarqueeReturn {
  const [selectionBox, setSelectionBox] = useState<MarqueeBox | null>(null);
  const isMarqueeSelectingRef = useRef(false);
  const marqueeStartPointerRef = useRef<{ x: number; y: number } | null>(null);
  const initialSelectedIdsOnStartRef = useRef<string[]>([]);
  const lastEmittedIdsRef = useRef<string[]>([]);

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!enabled) return;

      // Only initiate on left click (button 0)
      if ('button' in e.evt && e.evt.button !== 0) return;

      // Marquee must only start on empty canvas (stage or background)
      const stage = stageRef.current;
      if (!stage) return;
      if (e.target !== stage && e.target.name() !== 'canvas-background') return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Transform viewport screen pointer to canvas coordinates
      const scale = Math.max(0.01, viewport.scale);
      const canvasX = (pointer.x - viewport.x) / scale;
      const canvasY = (pointer.y - viewport.y) / scale;

      isMarqueeSelectingRef.current = true;
      marqueeStartPointerRef.current = { x: canvasX, y: canvasY };
      initialSelectedIdsOnStartRef.current = 'shiftKey' in e.evt && e.evt.shiftKey ? [...selectedIds] : [];
      lastEmittedIdsRef.current = [];
    },
    [enabled, stageRef, viewport.scale, viewport.x, viewport.y, selectedIds]
  );

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!isMarqueeSelectingRef.current || !marqueeStartPointerRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scale = Math.max(0.01, viewport.scale);
      const currentCanvasX = (pointer.x - viewport.x) / scale;
      const currentCanvasY = (pointer.y - viewport.y) / scale;

      const startX = marqueeStartPointerRef.current.x;
      const startY = marqueeStartPointerRef.current.y;

      const boxWidth = Math.abs(currentCanvasX - startX);
      const boxHeight = Math.abs(currentCanvasY - startY);

      // Require movement exceeding CLICK_VS_DRAG_THRESHOLD_PX before activating marquee
      if (boxWidth < CLICK_VS_DRAG_THRESHOLD_PX && boxHeight < CLICK_VS_DRAG_THRESHOLD_PX) {
        return;
      }

      const boxX = Math.min(startX, currentCanvasX);
      const boxY = Math.min(startY, currentCanvasY);

      setSelectionBox({
        startX,
        startY,
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
        visible: true,
      });

      const boxRight = boxX + boxWidth;
      const boxBottom = boxY + boxHeight;

      // AABB Box intersection with canvas items
      const hitItemIds = items
        .filter((item) => {
          const itemRight = item.x + item.width;
          const itemBottom = item.y + item.height;
          return (
            item.x < boxRight &&
            itemRight > boxX &&
            item.y < boxBottom &&
            itemBottom > boxY
          );
        })
        .map((i) => i.id);

      const targetIds =
        'shiftKey' in e.evt && e.evt.shiftKey
          ? Array.from(new Set([...initialSelectedIdsOnStartRef.current, ...hitItemIds]))
          : hitItemIds;

      // Only emit when the set of hit IDs has actually changed
      const prev = lastEmittedIdsRef.current;
      const isDifferent =
        prev.length !== targetIds.length ||
        prev.some((id, idx) => id !== targetIds[idx]);

      if (isDifferent) {
        lastEmittedIdsRef.current = targetIds;
        onSelectIds(targetIds);
      }
    },
    [items, onSelectIds, stageRef, viewport.scale, viewport.x, viewport.y]
  );

  const handleStageMouseUp = useCallback(() => {
    if (isMarqueeSelectingRef.current) {
      isMarqueeSelectingRef.current = false;
      marqueeStartPointerRef.current = null;
      lastEmittedIdsRef.current = [];
      setSelectionBox(null);
    }
  }, []);

  const cancelMarquee = useCallback(() => {
    isMarqueeSelectingRef.current = false;
    marqueeStartPointerRef.current = null;
    lastEmittedIdsRef.current = [];
    setSelectionBox(null);
  }, []);

  return {
    selectionBox,
    isMarqueeActive: Boolean(selectionBox && selectionBox.visible),
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    cancelMarquee,
  };
}
