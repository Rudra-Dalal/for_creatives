import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  pushToStack,
  popFromStack,
  reconcileStack,
  MAX_HISTORY_DEPTH,
} from '../historyStack';
import { useCanvasKeyboardShortcuts, isKeyboardTargetActive } from '../../selection/useCanvasKeyboardShortcuts';

// ---------------------------------------------------------------------------
// 1. historyStack — pure generic stack functions
// ---------------------------------------------------------------------------
// These tests use plain objects, not UndoAction, to keep historyStack.ts free
// of any circular dependency with useMoodboard.ts.

type SimpleAction = { type: string; id: string };

function makeAction(id: string, type = 'ADD'): SimpleAction {
  return { type, id };
}

describe('historyStack — pure functions', () => {
  describe('pushToStack', () => {
    it('adds an action to an empty stack', () => {
      const a = makeAction('a');
      const result = pushToStack([], a);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(a);
    });

    it('appends to an existing stack in LIFO-ready order (newest last)', () => {
      const a = makeAction('a');
      const b = makeAction('b');
      const c = makeAction('c');
      const stack = pushToStack(pushToStack(pushToStack([], a), b), c);
      expect(stack).toHaveLength(3);
      expect(stack[2]).toBe(c);
    });

    it('does not mutate the original array', () => {
      const original: SimpleAction[] = [makeAction('a')];
      const copy = [...original];
      pushToStack(original, makeAction('b'));
      expect(original).toEqual(copy);
    });

    it(`caps the stack at MAX_HISTORY_DEPTH (${MAX_HISTORY_DEPTH}) entries`, () => {
      let stack: SimpleAction[] = [];
      for (let i = 0; i < MAX_HISTORY_DEPTH + 5; i++) {
        stack = pushToStack(stack, makeAction(`item-${i}`));
      }
      expect(stack).toHaveLength(MAX_HISTORY_DEPTH);
    });

    it('discards the oldest entries when the limit is exceeded', () => {
      let stack: SimpleAction[] = [];
      for (let i = 0; i < MAX_HISTORY_DEPTH + 5; i++) {
        stack = pushToStack(stack, makeAction(`item-${i}`));
      }
      const ids = stack.map((a) => a.id);
      expect(ids).not.toContain('item-0');
      expect(ids).not.toContain('item-4');
      expect(ids[0]).toBe('item-5');
    });

    it('keeps the newest entry after overflow', () => {
      let stack: SimpleAction[] = [];
      const last = makeAction('last');
      for (let i = 0; i < MAX_HISTORY_DEPTH; i++) {
        stack = pushToStack(stack, makeAction(`item-${i}`));
      }
      stack = pushToStack(stack, last);
      expect(stack[stack.length - 1]).toBe(last);
      expect(stack).toHaveLength(MAX_HISTORY_DEPTH);
    });
  });

  // -------------------------------------------------------------------------

  describe('popFromStack', () => {
    it('returns null action and empty remaining when the stack is empty', () => {
      const result = popFromStack([]);
      expect(result.action).toBeNull();
      expect(result.remaining).toHaveLength(0);
    });

    it('returns the last (most recent) entry and shortens the stack by one', () => {
      const a = makeAction('a');
      const b = makeAction('b');
      const { action, remaining } = popFromStack([a, b]);
      expect(action).toBe(b);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toBe(a);
    });

    it('does not mutate the original array', () => {
      const original = [makeAction('a'), makeAction('b')];
      const len = original.length;
      popFromStack(original);
      expect(original).toHaveLength(len);
    });

    it('leaves an empty remaining after popping the only entry', () => {
      const { action, remaining } = popFromStack([makeAction('only')]);
      expect(action).not.toBeNull();
      expect(remaining).toHaveLength(0);
      expect(popFromStack(remaining).action).toBeNull();
    });
  });

  // -------------------------------------------------------------------------

  describe('LIFO ordering — sequential undo emulation', () => {
    it('pops 3 actions in reverse (LIFO) order', () => {
      const a = makeAction('a');
      const b = makeAction('b');
      const c = makeAction('c');
      let stack = pushToStack(pushToStack(pushToStack([], a), b), c);

      const { action: third, remaining: r1 } = popFromStack(stack);
      const { action: second, remaining: r2 } = popFromStack(r1);
      const { action: first, remaining: r3 } = popFromStack(r2);
      const { action: empty } = popFromStack(r3);

      expect(third).toBe(c);
      expect(second).toBe(b);
      expect(first).toBe(a);
      expect(empty).toBeNull();
    });
  });

  // -------------------------------------------------------------------------

  describe('undo → redo branching', () => {
    it('simulates: record A, record B → undo B → redo B', () => {
      const a = makeAction('a');
      const b = makeAction('b');

      let undoStack = pushToStack(pushToStack([], a), b);
      let redoStack: SimpleAction[] = [];

      // Undo B
      const { action: undoneB, remaining: u1 } = popFromStack(undoStack);
      undoStack = u1;
      redoStack = pushToStack(redoStack, undoneB!);

      expect(undoStack).toHaveLength(1);
      expect(undoStack[0]).toBe(a);
      expect(redoStack).toHaveLength(1);
      expect(redoStack[0]).toBe(b);

      // Redo B
      const { action: redoneB, remaining: r1 } = popFromStack(redoStack);
      redoStack = r1;
      undoStack = pushToStack(undoStack, redoneB!);

      expect(undoStack).toHaveLength(2);
      expect(undoStack[1]).toBe(b);
      expect(redoStack).toHaveLength(0);
    });

    it('simulates branching: record A, B → undo B → record C clears redo', () => {
      const a = makeAction('a');
      const b = makeAction('b');
      const c = makeAction('c');

      let undoStack = pushToStack(pushToStack([], a), b);
      let redoStack: SimpleAction[] = [];

      // Undo B
      const { action: undoneB, remaining } = popFromStack(undoStack);
      undoStack = remaining;
      redoStack = pushToStack(redoStack, undoneB!);

      // New action C — clears redo branch (mimics recordUndoAction behaviour)
      undoStack = pushToStack(undoStack, c);
      redoStack = [];

      expect(undoStack).toHaveLength(2);
      expect(undoStack[1]).toBe(c);
      expect(redoStack).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe('reconcileStack', () => {
    it('maps each item through the callback', () => {
      const items = [makeAction('temp-a'), makeAction('stable-b')];
      const result = reconcileStack(items, (item) =>
        item.id === 'temp-a' ? { ...item, id: 'real-a' } : item
      );
      expect(result[0].id).toBe('real-a');
      expect(result[1].id).toBe('stable-b');
    });

    it('leaves items unchanged when the callback is the identity', () => {
      const items = [makeAction('x'), makeAction('y')];
      const result = reconcileStack(items, (i) => i);
      expect(result[0]).toBe(items[0]);
      expect(result[1]).toBe(items[1]);
    });

    it('does not mutate the original stack', () => {
      const items = [makeAction('orig')];
      reconcileStack(items, (i) => ({ ...i, id: 'changed' }));
      expect(items[0].id).toBe('orig');
    });

    it('returns an empty array for an empty stack', () => {
      expect(reconcileStack([], (i) => i)).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Keyboard shortcuts — Undo and Redo dispatch
// ---------------------------------------------------------------------------

function renderKeyboardShortcuts(opts: Parameters<typeof useCanvasKeyboardShortcuts>[0]) {
  let result!: ReturnType<typeof useCanvasKeyboardShortcuts>;
  function Harness() {
    result = useCanvasKeyboardShortcuts(opts);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

function makeKeyEvent(
  key: string,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}
): KeyboardEvent {
  return {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    altKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('useCanvasKeyboardShortcuts — Undo / Redo', () => {
  let onUndo: ReturnType<typeof vi.fn>;
  let onRedo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUndo = vi.fn();
    onRedo = vi.fn();
  });

  it('Ctrl+Z calls onUndo and NOT onRedo', () => {
    const { handleKeyDown } = renderKeyboardShortcuts({
      selectedIds: [],
      readOnly: false,
      onUndo,
      onRedo,
    });
    handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('Cmd+Z (metaKey) calls onUndo and NOT onRedo', () => {
    const { handleKeyDown } = renderKeyboardShortcuts({
      selectedIds: [],
      readOnly: false,
      onUndo,
      onRedo,
    });
    handleKeyDown(makeKeyEvent('z', { metaKey: true }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+Z calls onRedo and NOT onUndo', () => {
    const { handleKeyDown } = renderKeyboardShortcuts({
      selectedIds: [],
      readOnly: false,
      onUndo,
      onRedo,
    });
    handleKeyDown(makeKeyEvent('z', { ctrlKey: true, shiftKey: true }));
    expect(onRedo).toHaveBeenCalledOnce();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('Cmd+Shift+Z (metaKey) calls onRedo and NOT onUndo', () => {
    const { handleKeyDown } = renderKeyboardShortcuts({
      selectedIds: [],
      readOnly: false,
      onUndo,
      onRedo,
    });
    handleKeyDown(makeKeyEvent('z', { metaKey: true, shiftKey: true }));
    expect(onRedo).toHaveBeenCalledOnce();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('uppercase Z still triggers Undo (case-insensitive)', () => {
    const { handleKeyDown } = renderKeyboardShortcuts({
      selectedIds: [],
      readOnly: false,
      onUndo,
      onRedo,
    });
    handleKeyDown(makeKeyEvent('Z', { ctrlKey: true }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('uppercase Z + Shift triggers Redo (case-insensitive)', () => {
    const { handleKeyDown } = renderKeyboardShortcuts({
      selectedIds: [],
      readOnly: false,
      onUndo,
      onRedo,
    });
    handleKeyDown(makeKeyEvent('Z', { ctrlKey: true, shiftKey: true }));
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('does NOT call onUndo or onRedo in readOnly mode', () => {
    const { handleKeyDown } = renderKeyboardShortcuts({
      selectedIds: [],
      readOnly: true,
      onUndo,
      onRedo,
    });
    handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));
    handleKeyDown(makeKeyEvent('z', { ctrlKey: true, shiftKey: true }));
    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Text input / active element protection
  // -------------------------------------------------------------------------

  describe('text input / active element protection', () => {
    it('does not trigger when isTextInputActive returns true', () => {
      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: [],
        readOnly: false,
        isTextInputActive: () => true,
        onUndo,
        onRedo,
      });
      handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));
      handleKeyDown(makeKeyEvent('z', { ctrlKey: true, shiftKey: true }));
      expect(onUndo).not.toHaveBeenCalled();
      expect(onRedo).not.toHaveBeenCalled();
    });

    function withActiveElement(
      tag: string,
      extra: Record<string, unknown> = {},
      run: (handleKeyDown: (e: KeyboardEvent) => void) => void
    ) {
      const originalDoc = (globalThis as unknown as { document?: unknown }).document;
      const mockEl = { tagName: tag.toUpperCase(), ...extra };
      (globalThis as unknown as { document: unknown }).document = { activeElement: mockEl };
      try {
        const { handleKeyDown } = renderKeyboardShortcuts({
          selectedIds: [],
          readOnly: false,
          onUndo,
          onRedo,
        });
        run(handleKeyDown);
      } finally {
        if (originalDoc === undefined) {
          delete (globalThis as unknown as { document?: unknown }).document;
        } else {
          (globalThis as unknown as { document: unknown }).document = originalDoc;
        }
      }
    }

    it('does not trigger when INPUT is focused', () => {
      withActiveElement('input', {}, (handleKeyDown) => {
        handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));
        handleKeyDown(makeKeyEvent('z', { ctrlKey: true, shiftKey: true }));
        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
      });
    });

    it('does not trigger when TEXTAREA is focused', () => {
      withActiveElement('textarea', {}, (handleKeyDown) => {
        handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));
        handleKeyDown(makeKeyEvent('z', { ctrlKey: true, shiftKey: true }));
        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
      });
    });

    it('does not trigger when a contentEditable element is focused', () => {
      withActiveElement('div', { isContentEditable: true }, (handleKeyDown) => {
        handleKeyDown(makeKeyEvent('z', { ctrlKey: true }));
        handleKeyDown(makeKeyEvent('z', { ctrlKey: true, shiftKey: true }));
        expect(onUndo).not.toHaveBeenCalled();
        expect(onRedo).not.toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // isKeyboardTargetActive utility
  // -------------------------------------------------------------------------

  describe('isKeyboardTargetActive', () => {
    it('returns false when document is undefined (SSR/Node)', () => {
      expect(isKeyboardTargetActive()).toBe(false);
    });

    function withActiveElement(tag: string, extra: Record<string, unknown> = {}) {
      const originalDoc = (globalThis as unknown as { document?: unknown }).document;
      const mockEl = { tagName: tag.toUpperCase(), ...extra };
      (globalThis as unknown as { document: unknown }).document = { activeElement: mockEl };
      try {
        return isKeyboardTargetActive();
      } finally {
        if (originalDoc === undefined) {
          delete (globalThis as unknown as { document?: unknown }).document;
        } else {
          (globalThis as unknown as { document: unknown }).document = originalDoc;
        }
      }
    }

    it('returns true for INPUT',    () => expect(withActiveElement('input')).toBe(true));
    it('returns true for TEXTAREA', () => expect(withActiveElement('textarea')).toBe(true));
    it('returns true for SELECT',   () => expect(withActiveElement('select')).toBe(true));
    it('returns true for contentEditable div', () =>
      expect(withActiveElement('div', { isContentEditable: true })).toBe(true));
    it('returns false for a plain DIV', () =>
      expect(withActiveElement('div')).toBe(false));
    it('returns false for BODY',    () =>
      expect(withActiveElement('body')).toBe(false));
  });
});
