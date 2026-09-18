'use client';

/**
 * useConnectionDrag
 *
 * Manages the full lifecycle of a Storyboard sequence connection drag:
 *   1. Anchor mousedown  → begin drag (refs only, no React state)
 *   2. Stage mousemove   → update preview endpoint imperatively
 *   3. Stage mouseup     → commit or cancel
 *   4. Escape / tool change → cancel
 *
 * Design constraints:
 *  - Zero React state updates during pointer move (smooth 60fps preview).
 *  - All DB writes go through the hook's onCreateConnection callback —
 *    never raw Supabase calls from here.
 *  - Pure interaction logic; geometry delegated to storyboardConnections utils.
 */

import { useRef, useCallback, useEffect } from 'react';
import type Konva from 'konva';
import {
  findClosestShotAnchor,
  isSelfConnection,
  isDuplicateConnection,
} from '../utils/storyboardConnections';
import type { AnchorPosition, StoryboardShotWithLinks, StoryboardShotConnection, StoryboardTool } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectionDragState {
  active: boolean;
  fromShotId: string;
  fromAnchor: AnchorPosition;
  /** Start point in world-space coordinates */
  fromPoint: { x: number; y: number };
  /** Live preview end in world-space, updated every pointermove */
  previewEnd: { x: number; y: number };
  /** Valid snap target while dragging */
  snapTarget: { shotId: string; anchor: AnchorPosition; point: { x: number; y: number } } | null;
}

export interface UseConnectionDragOptions {
  activeTool: StoryboardTool;
  viewport: { x: number; y: number; scale: number };
  allShots: StoryboardShotWithLinks[];
  existingConnections: StoryboardShotConnection[];
  onCreateConnection: (input: {
    fromShotId: string;
    toShotId: string;
    fromAnchor: AnchorPosition;
    toAnchor: AnchorPosition;
  }) => Promise<StoryboardShotConnection | null>;
  /** Called every frame during drag so the layer can imperatively update the preview shape */
  onDragStateChange?: (state: ConnectionDragState | null) => void;
}

export interface UseConnectionDragReturn {
  /** Ref to the current drag state (read-only for consumers) */
  dragStateRef: React.MutableRefObject<ConnectionDragState | null>;
  /** Called by StoryboardShotAnchorHandles on anchor mousedown */
  handleAnchorMouseDown: (
    shotId: string,
    anchor: AnchorPosition,
    worldPoint: { x: number; y: number },
    e: Konva.KonvaEventObject<MouseEvent>
  ) => void;
  /** Forward to StoryboardStage's onStageMouseMove */
  handleConnectionMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  /** Forward to StoryboardStage's onStageMouseUp */
  handleConnectionMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  /** Cancel any active drag — call when tool changes or Escape fires */
  cancelDrag: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConnectionDrag({
  activeTool,
  viewport,
  allShots,
  existingConnections,
  onCreateConnection,
  onDragStateChange,
}: UseConnectionDragOptions): UseConnectionDragReturn {
  const dragStateRef = useRef<ConnectionDragState | null>(null);

  // Notify consumer on every drag state mutation
  const notifyChange = useCallback(
    (state: ConnectionDragState | null) => {
      onDragStateChange?.(state);
    },
    [onDragStateChange]
  );

  const cancelDrag = useCallback(() => {
    dragStateRef.current = null;
    notifyChange(null);
  }, [notifyChange]);

  // Cancel drag whenever tool changes away from 'connect'
  useEffect(() => {
    if (activeTool !== 'connect') {
      cancelDrag();
    }
  }, [activeTool, cancelDrag]);

  const handleAnchorMouseDown = useCallback(
    (
      shotId: string,
      anchor: AnchorPosition,
      worldPoint: { x: number; y: number },
      e: Konva.KonvaEventObject<MouseEvent>
    ) => {
      if (activeTool !== 'connect') return;
      e.cancelBubble = true; // prevent stage mousedown from firing

      const newState: ConnectionDragState = {
        active: true,
        fromShotId: shotId,
        fromAnchor: anchor,
        fromPoint: worldPoint,
        previewEnd: worldPoint,
        snapTarget: null,
      };
      dragStateRef.current = newState;
      notifyChange(newState);
    },
    [activeTool, notifyChange]
  );

  const handleConnectionMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const drag = dragStateRef.current;
      if (!drag?.active) return;

      // Convert stage pointer to world coordinates
      const stage = e.target.getStage();
      if (!stage) return;
      const stagePointer = stage.getPointerPosition();
      if (!stagePointer) return;

      const worldPointer = {
        x: (stagePointer.x - viewport.x) / viewport.scale,
        y: (stagePointer.y - viewport.y) / viewport.scale,
      };

      // Find closest valid snap target
      const snap = findClosestShotAnchor(worldPointer, allShots, {
        scale: viewport.scale,
        excludeShotId: drag.fromShotId,
      });

      // Validate: no self-connection, no active duplicate
      let validSnap = snap;
      if (snap) {
        if (isSelfConnection(drag.fromShotId, snap.shotId)) {
          validSnap = null;
        } else if (isDuplicateConnection(existingConnections, drag.fromShotId, snap.shotId)) {
          validSnap = null;
        }
      }

      const updated: ConnectionDragState = {
        ...drag,
        previewEnd: validSnap ? validSnap.point : worldPointer,
        snapTarget: validSnap
          ? { shotId: validSnap.shotId, anchor: validSnap.anchor, point: validSnap.point }
          : null,
      };
      dragStateRef.current = updated;
      notifyChange(updated);
    },
    [viewport, allShots, existingConnections, notifyChange]
  );

  const handleConnectionMouseUp = useCallback(
    async (e: Konva.KonvaEventObject<MouseEvent>) => {
      const drag = dragStateRef.current;
      if (!drag?.active) return;

      const snapTarget = drag.snapTarget;

      // Clear drag state first so preview disappears even if service call is slow
      dragStateRef.current = null;
      notifyChange(null);

      if (!snapTarget) {
        // Released on empty canvas — cancel silently
        return;
      }

      // Commit connection
      await onCreateConnection({
        fromShotId: drag.fromShotId,
        toShotId: snapTarget.shotId,
        fromAnchor: drag.fromAnchor,
        toAnchor: snapTarget.anchor,
      });
    },
    [onCreateConnection, notifyChange]
  );

  return {
    dragStateRef,
    handleAnchorMouseDown,
    handleConnectionMouseMove,
    handleConnectionMouseUp,
    cancelDrag,
  };
}
