'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UseCanvasKeyboardShortcutsOptions } from './selectionTypes';

/**
 * Checks if keyboard events should be ignored because an input element is focused.
 */
export function isKeyboardTargetActive(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tagName = active.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Centralized keyboard shortcuts controller for the moodboard canvas.
 *
 * Supported Bindings:
 * - Delete / Backspace: Delete selected items
 * - Cmd+A / Ctrl+A: Select all items
 * - Escape: Clear selection / cancel active tool
 * - Cmd+D / Ctrl+D: Duplicate selected items
 * - Cmd+Z / Ctrl+Z: Undo last canvas action
 * - Arrow Keys: Nudge selected items by 1px (or 10px with Shift)
 * - V / P / E / Shift+P: Tool switching
 * - Shift: Multi-selection modifier tracking
 */
export function useCanvasKeyboardShortcuts({
  selectedIds,
  readOnly = false,
  onDeleteSelected,
  onSelectAll,
  onClearSelection,
  onDuplicateSelected,
  onNudgeSelected,
  onUndo,
  onRedo,
  onToolChange,
  isTextInputActive = isKeyboardTargetActive,
}: UseCanvasKeyboardShortcutsOptions) {
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore shortcut triggers when user is typing in text fields
      if (isTextInputActive()) return;

      // Track Shift modifier
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }

      // Tool Switch shortcuts: V (Select), P (Pen), E / Shift+P (Eraser)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const lowerKey = e.key.toLowerCase();
        if (lowerKey === 'p' && e.shiftKey) {
          e.preventDefault();
          onToolChange?.('eraser');
          return;
        }
        if (lowerKey === 'e') {
          e.preventDefault();
          onToolChange?.('eraser');
          return;
        }
        if (lowerKey === 'p' && !e.shiftKey) {
          e.preventDefault();
          onToolChange?.('pen');
          return;
        }
        if (lowerKey === 'v') {
          e.preventDefault();
          onToolChange?.('select');
          return;
        }
      }

      // Escape: Clear selection or return to select tool
      if (e.key === 'Escape') {
        onToolChange?.('select');
        onClearSelection?.();
        return;
      }

      // Block all mutation shortcuts in read-only mode
      if (readOnly) return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Select All: Cmd/Ctrl + A
      if (isCmdOrCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        onSelectAll?.();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z (checked before Undo so Shift+Z is not swallowed)
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Undo: Cmd/Ctrl + Z (without Shift)
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo?.();
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          onDeleteSelected?.();
          return;
        }
      }

      // Duplicate: Cmd/Ctrl + D
      if (isCmdOrCtrl && e.key.toLowerCase() === 'd') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          onDuplicateSelected?.();
          return;
        }
      }

      // Arrow keys nudge: 1px normal, 10px with Shift
      if (
        selectedIds.length > 0 &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        onNudgeSelected?.(dx, dy);
        return;
      }
    },
    [
      isTextInputActive,
      onToolChange,
      onClearSelection,
      readOnly,
      onSelectAll,
      onUndo,
      onRedo,
      selectedIds,
      onDeleteSelected,
      onDuplicateSelected,
      onNudgeSelected,
    ]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Shift') {
      setIsShiftPressed(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    isShiftPressed,
    handleKeyDown,
    handleKeyUp,
  };
}
