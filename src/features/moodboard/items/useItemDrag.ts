'use client';

import { useRef, useCallback, useState } from 'react';
import type Konva from 'konva';
import type { MoodboardItem } from '../types';
import type { UndoAction } from '../hooks/useMoodboard';

/**
 * Callbacks that useItemDrag calls back into MoodboardStage / useMoodboard.
 * Keeping them explicit keeps the drag hook free of ambient closures.
 */
export interface UseItemDragCallbacks {
  /** Current items list — read-only snapshot consulted on dragStart and dragEnd. */
  items: MoodboardItem[];
  /** Current effective selection (single or multi). */
  selectedIds: string[];
  /** Whether the canvas is in read-only mode. */
  readOnly?: boolean;
  /** Ref to the Konva Stage, used to resolve sibling nodes during multi-drag. */
  stageRef: React.RefObject<Konva.Stage | null>;
  /** Callback to update React state with a new selection before drag starts. */
  onSelectIds: (ids: string[]) => void;
  /** Optimistic local update (no DB round-trip). */
  onUpdateItemLocal: (
    id: string,
    updates: Partial<Pick<MoodboardItem, 'x' | 'y' | 'width' | 'height'>>
  ) => void;
  /** Persist committed geometry to the database. */
  onPersistGeometry: (
    id: string,
    geometry: { x: number; y: number; width: number; height: number; zIndex?: number }
  ) => void;
  /** Push an undo action for single-step rollback. */
  onRecordUndoAction?: (action: UndoAction) => void;
  /** Bring dragged item to front in the z-stack. */
  onBringToFront: (id: string) => void;
}

/**
 * Values returned by useItemDrag, consumed by ItemsLayer and card renderers.
 */
export interface UseItemDragReturn {
  /**
   * Call on dragStart for any item. Records initial positions for all
   * selected items and ensures selection is set correctly.
   */
  handleItemDragStart: (item: MoodboardItem) => void;
  /**
   * Attached to the Stage onDragMove event. Synchronizes sibling selected
   * items' Konva positions in real-time and schedules a RAF-gated React
   * tick to re-render connector arrows and anchor handles.
   *
   * Returns true if the event was consumed (caller should early-return).
   */
  handleStageDragMove: (e: Konva.KonvaEventObject<DragEvent>) => boolean;
  /**
   * Called by individual card renderers when their Konva Group's onDragEnd
   * fires. Commits geometry to local state and DB, records undo action.
   */
  handleItemDragEnd: (id: string, x: number, y: number) => void;
  /**
   * Call when a dimension auto-correction fires while the item is still being
   * dragged (e.g. natural aspect ratio correction in ReferenceCard). The
   * corrected dimensions are queued and applied atomically at dragEnd.
   */
  handleDimensionsCorrected: (id: string, width: number, height: number) => void;
  /**
   * Incrementing tick that forces ItemsLayer to re-read live drag positions
   * from the ref on each animation frame — drives connector/anchor updates.
   */
  liveDragTick: number;
  /**
   * Live position map: itemId -> {x, y} during an active drag.
   * Read-only reference — do not mutate externally.
   */
  liveDragPositionsRef: React.MutableRefObject<Map<string, { x: number; y: number }>>;
}

/**
 * Single authoritative drag controller for all moodboard canvas items.
 *
 * Responsibilities:
 *  1. Record initial geometry for every selected item on dragStart.
 *  2. During dragMove: propagate the primary item's displacement offset to all
 *     other selected items via direct Konva node mutation (no React re-render).
 *  3. Schedule one RAF per frame to tick liveDragTick, keeping connector
 *     arrows and anchor handles attached in real-time.
 *  4. On dragEnd: compute final positions for every selected item, persist
 *     geometry to DB, and record a single MOVE undo action per moved item.
 *
 * This hook is deliberately free of canvas coordinate math, item-type
 * specifics, and viewport concerns — those live in their respective modules.
 */
export function useItemDrag({
  items,
  selectedIds,
  readOnly = false,
  stageRef,
  onSelectIds,
  onUpdateItemLocal,
  onPersistGeometry,
  onRecordUndoAction,
  onBringToFront,
}: UseItemDragCallbacks): UseItemDragReturn {
  /** Start position of each selected item at the moment drag begins. */
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  /** Immutable geometry snapshot at drag-start, used for undo diff. */
  const initialGeometryRef = useRef<Map<string, { x: number; y: number; width: number; height: number; zIndex?: number }>>(new Map());
  /** Real-time live position of each selected item, updated per animation frame. */
  const liveDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  /** Pending dimension corrections queued while a drag is in progress. */
  const pendingDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  /** RAF handle — ensures at most one pending frame tick at a time. */
  const dragRafRef = useRef<number | null>(null);
  /** React tick counter that forces ItemsLayer to re-read live positions. */
  const [liveDragTick, setLiveDragTick] = useState(0);

  // ── dragStart ──────────────────────────────────────────────────────────────

  const handleItemDragStart = useCallback(
    (item: MoodboardItem) => {
      if (readOnly) return;

      // Normalize selection: if the dragged item is not in the current
      // selection, snap to single-item selection before recording positions.
      let currentSelection = selectedIds;
      if (!currentSelection.includes(item.id)) {
        currentSelection = [item.id];
        onSelectIds([item.id]);
      }

      // Snapshot start positions and initial geometry for all selected items
      dragStartPositionsRef.current.clear();
      currentSelection.forEach((id) => {
        const itm = items.find((i) => i.id === id);
        if (!itm) return;
        dragStartPositionsRef.current.set(id, { x: itm.x, y: itm.y });
        initialGeometryRef.current.set(id, {
          x: itm.x,
          y: itm.y,
          width: itm.width,
          height: itm.height,
          zIndex: itm.z_index,
        });
        // Bring all items in the selection to the visual front in Konva
        const konvaNode = stageRef.current?.findOne('#' + id);
        if (konvaNode) konvaNode.moveToTop();
      });
    },
    [readOnly, selectedIds, items, stageRef, onSelectIds]
  );

  // ── dragMove (Stage-level event) ───────────────────────────────────────────

  const handleStageDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>): boolean => {
      if (e.target === stageRef.current) return false;

      // Walk up the Konva tree to find the item-level node
      let draggedNode: Konva.Node = e.target;
      let draggedId = draggedNode.id();
      if (!draggedId || !items.some((i) => i.id === draggedId)) {
        const ancestor = draggedNode.findAncestor('.moodboard-item', true);
        if (ancestor) {
          draggedNode = ancestor as Konva.Node;
          draggedId = (ancestor as Konva.Node).id();
        }
      }
      if (!draggedId) return false;

      const itm = items.find((i) => i.id === draggedId);
      if (!itm) return false;

      // Lazily initialise start position if dragStart was missed
      let startPos = dragStartPositionsRef.current.get(draggedId);
      if (!startPos) {
        startPos = { x: itm.x, y: itm.y };
        dragStartPositionsRef.current.set(draggedId, startPos);
      }

      const dx = draggedNode.x() - startPos.x;
      const dy = draggedNode.y() - startPos.y;

      // Track primary item live position
      liveDragPositionsRef.current.set(draggedId, {
        x: draggedNode.x(),
        y: draggedNode.y(),
      });

      // Synchronize all other selected items' Konva positions without
      // going through React state — this keeps the move at 60/120fps
      if (selectedIds.length > 1 && selectedIds.includes(draggedId)) {
        selectedIds.forEach((id) => {
          if (id === draggedId) return;
          const node = stageRef.current?.findOne(`#${id}`);
          let otherStart = dragStartPositionsRef.current.get(id);
          if (!otherStart) {
            const otherItm = items.find((i) => i.id === id);
            if (otherItm) {
              otherStart = { x: otherItm.x, y: otherItm.y };
              dragStartPositionsRef.current.set(id, otherStart);
            }
          }
          if (node && otherStart) {
            const newX = otherStart.x + dx;
            const newY = otherStart.y + dy;
            node.x(newX);
            node.y(newY);
            liveDragPositionsRef.current.set(id, { x: newX, y: newY });
          }
        });
      }

      // Schedule one RAF per frame to drive connector/anchor re-renders
      if (dragRafRef.current === null) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null;
          setLiveDragTick((t) => (t + 1) % 10000);
        });
      }

      return true;
    },
    [items, selectedIds, stageRef]
  );

  // ── dragEnd ────────────────────────────────────────────────────────────────

  const handleItemDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      if (readOnly) return;

      if (selectedIds.length > 1 && selectedIds.includes(id)) {
        // Multi-item commit: apply shared offset to all selected items
        const startPos = dragStartPositionsRef.current.get(id);
        const dx = startPos ? x - startPos.x : 0;
        const dy = startPos ? y - startPos.y : 0;

        selectedIds.forEach((selectedId) => {
          const item = items.find((i) => i.id === selectedId);
          if (!item) return;

          const pendingDim = pendingDimensionsRef.current.get(selectedId);
          if (pendingDim) pendingDimensionsRef.current.delete(selectedId);
          const wToSave = pendingDim ? pendingDim.width : item.width;
          const hToSave = pendingDim ? pendingDim.height : item.height;

          const finalX = selectedId === id ? x : Math.round(item.x + dx);
          const finalY = selectedId === id ? y : Math.round(item.y + dy);
          const initial = initialGeometryRef.current.get(selectedId);

          onUpdateItemLocal(selectedId, { x: finalX, y: finalY, width: wToSave, height: hToSave });
          onPersistGeometry(selectedId, { x: finalX, y: finalY, width: wToSave, height: hToSave, zIndex: item.z_index });

          if (initial && (initial.x !== finalX || initial.y !== finalY)) {
            onRecordUndoAction?.({
              type: 'MOVE',
              itemId: selectedId,
              prevGeometry: initial,
              nextGeometry: { x: finalX, y: finalY, width: wToSave, height: hToSave, zIndex: item.z_index },
            });
          }
          onBringToFront(selectedId);
        });
      } else {
        // Single-item commit
        const item = items.find((i) => i.id === id);
        if (!item) return;

        const pendingDim = pendingDimensionsRef.current.get(id);
        if (pendingDim) pendingDimensionsRef.current.delete(id);
        const wToSave = pendingDim ? pendingDim.width : item.width;
        const hToSave = pendingDim ? pendingDim.height : item.height;
        const initial = initialGeometryRef.current.get(id);

        if (initial && (initial.x !== x || initial.y !== y)) {
          onRecordUndoAction?.({
            type: 'MOVE',
            itemId: id,
            prevGeometry: initial,
            nextGeometry: { x, y, width: wToSave, height: hToSave, zIndex: item.z_index },
          });
        }

        onUpdateItemLocal(id, { x, y, width: wToSave, height: hToSave });
        onPersistGeometry(id, { x, y, width: wToSave, height: hToSave, zIndex: item.z_index });
        onBringToFront(id);
      }

      // Cleanup
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      liveDragPositionsRef.current.clear();
      setLiveDragTick((t) => (t + 1) % 10000);
    },
    [readOnly, selectedIds, items, onUpdateItemLocal, onPersistGeometry, onRecordUndoAction, onBringToFront]
  );

  // ── dimension correction (queued during drag) ──────────────────────────────

  const handleDimensionsCorrected = useCallback(
    (id: string, width: number, height: number) => {
      if (liveDragPositionsRef.current.has(id)) {
        // Item is mid-drag — queue and apply atomically at dragEnd
        pendingDimensionsRef.current.set(id, { width, height });
        return;
      }
      // No active drag — apply immediately
      onUpdateItemLocal(id, { width, height });
      const item = items.find((i) => i.id === id);
      if (item) {
        onPersistGeometry(id, { x: item.x, y: item.y, width, height, zIndex: item.z_index });
      }
    },
    [items, onUpdateItemLocal, onPersistGeometry]
  );

  return {
    handleItemDragStart,
    handleStageDragMove,
    handleItemDragEnd,
    handleDimensionsCorrected,
    liveDragTick,
    liveDragPositionsRef,
  };
}
