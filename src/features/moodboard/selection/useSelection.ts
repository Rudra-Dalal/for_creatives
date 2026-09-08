'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { CLICK_VS_DRAG_THRESHOLD_PX } from '../coordinates';
import type { UseSelectionOptions, UseSelectionReturn } from './selectionTypes';

/**
 * Authoritative selection controller for moodboard canvas items.
 *
 * Responsibilities:
 * - Single source of truth for `selectedIds`
 * - Shift-click multi-selection toggling
 * - Batch selection and clear operations
 * - Click-vs-drag collapse logic using authoritative CLICK_VS_DRAG_THRESHOLD_PX
 * - Strict readOnly mode guards
 */
export function useSelection({
  initialSelectedIds = [],
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  readOnly = false,
}: UseSelectionOptions = {}): UseSelectionReturn {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>(initialSelectedIds);
  const selectedIds = controlledSelectedIds !== undefined ? controlledSelectedIds : internalSelectedIds;

  const selectedIdsRef = useRef<string[]>(selectedIds);
  selectedIdsRef.current = selectedIds;

  const updateSelection = useCallback(
    (newIds: string[]) => {
      if (readOnly) return;
      // Deduplicate and filter empty strings
      const uniqueIds = Array.from(new Set(newIds.filter(Boolean)));
      selectedIdsRef.current = uniqueIds;
      setInternalSelectedIds(uniqueIds);
      onSelectionChange?.(uniqueIds);
    },
    [readOnly, onSelectionChange]
  );

  const select = useCallback(
    (id: string | null) => {
      if (id === null) {
        updateSelection([]);
      } else {
        updateSelection([id]);
      }
    },
    [updateSelection]
  );

  const toggleSelect = useCallback(
    (id: string) => {
      if (!id) return;
      const current = selectedIdsRef.current;
      if (current.includes(id)) {
        updateSelection(current.filter((item) => item !== id));
      } else {
        updateSelection([...current, id]);
      }
    },
    [updateSelection]
  );

  const setSelection = useCallback(
    (ids: string[]) => {
      updateSelection(ids);
    },
    [updateSelection]
  );

  const extendSelection = useCallback(
    (ids: string[]) => {
      updateSelection(Array.from(new Set([...selectedIdsRef.current, ...ids])));
    },
    [updateSelection]
  );

  const clearSelection = useCallback(() => {
    updateSelection([]);
  }, [updateSelection]);

  const selectAll = useCallback(
    (allIds: string[]) => {
      updateSelection(allIds);
    },
    [updateSelection]
  );

  const handleClick = useCallback(
    (id: string, isShiftPressed = false) => {
      if (!id || readOnly) return;
      if (isShiftPressed) {
        toggleSelect(id);
      } else {
        select(id);
      }
    },
    [readOnly, toggleSelect, select]
  );

  /**
   * Called on item pointer-down.
   * If the clicked item is already part of a multi-selection, do NOT collapse it immediately,
   * so that dragging the item will drag the entire multi-selection together.
   * If it is not part of the selection, collapse to this item immediately.
   */
  const handlePointerDownItem = useCallback(
    (id: string, isShiftPressed = false) => {
      if (!id || readOnly) return;
      if (isShiftPressed) {
        toggleSelect(id);
      } else if (!selectedIdsRef.current.includes(id)) {
        select(id);
      }
    },
    [readOnly, toggleSelect, select]
  );

  /**
   * Called on item click/pointer-up after a stationary or near-stationary gesture.
   * If pointer movement was within CLICK_VS_DRAG_THRESHOLD_PX, collapse a multi-selection
   * down to the clicked item. If pointer movement exceeded the threshold, preserve the multi-selection.
   */
  const handleClickVsDragCollapse = useCallback(
    (id: string, dragDistancePx: number) => {
      if (!id || readOnly) return;
      if (dragDistancePx <= CLICK_VS_DRAG_THRESHOLD_PX) {
        if (selectedIdsRef.current.length > 1 && selectedIdsRef.current.includes(id)) {
          select(id);
        }
      }
    },
    [readOnly, select]
  );

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const selectedCount = selectedIds.length;
  const isSingleSelection = selectedCount === 1;
  const hasSelection = selectedCount > 0;

  return useMemo(
    () => ({
      selectedIds,
      select,
      toggleSelect,
      setSelection,
      extendSelection,
      clearSelection,
      selectAll,
      handleClick,
      handlePointerDownItem,
      handleClickVsDragCollapse,
      isSelected,
      selectedCount,
      isSingleSelection,
      hasSelection,
    }),
    [
      selectedIds,
      select,
      toggleSelect,
      setSelection,
      extendSelection,
      clearSelection,
      selectAll,
      handleClick,
      handlePointerDownItem,
      handleClickVsDragCollapse,
      isSelected,
      selectedCount,
      isSingleSelection,
      hasSelection,
    ]
  );
}
