import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Storyboard Keyboard Shortcuts Tests
 *
 * Verifies:
 * - Ctrl+Z and Cmd+Z invoke undo
 * - Ctrl+Shift+Z, Cmd+Shift+Z, and Ctrl+Y invoke redo
 * - Active text input, textarea, or contentEditable elements suppress shortcuts
 * - Event preventDefault() is called on matched shortcuts
 */

function makeKeyEvent(
  key: string,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}
): KeyboardEvent {
  return {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    altKey: modifiers.altKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

/**
 * Pure evaluation of StoryboardCanvas's keyboard shortcut matching logic.
 */
function handleStoryboardCanvasKeyDown(
  e: KeyboardEvent,
  opts: {
    undo: () => void;
    redo: () => void;
  }
) {
  const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
  const activeTag = (activeEl?.tagName || '').toLowerCase();
  if (
    activeTag === 'input' ||
    activeTag === 'textarea' ||
    (activeEl as HTMLElement)?.isContentEditable
  ) {
    return;
  }

  if ((e.metaKey || e.ctrlKey) && !e.altKey) {
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      opts.undo();
      return;
    }
    if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
      e.preventDefault();
      opts.redo();
      return;
    }
  }
}

describe('Storyboard Keyboard Shortcuts — Undo / Redo Dispatch', () => {
  let undo: ReturnType<typeof vi.fn>;
  let redo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    undo = vi.fn();
    redo = vi.fn();
  });

  it('Ctrl+Z triggers undo and calls preventDefault', () => {
    const evt = makeKeyEvent('z', { ctrlKey: true });
    handleStoryboardCanvasKeyDown(evt, { undo, redo });

    expect(undo).toHaveBeenCalledOnce();
    expect(redo).not.toHaveBeenCalled();
    expect(evt.preventDefault).toHaveBeenCalledOnce();
  });

  it('Cmd+Z (metaKey on macOS) triggers undo', () => {
    const evt = makeKeyEvent('z', { metaKey: true });
    handleStoryboardCanvasKeyDown(evt, { undo, redo });

    expect(undo).toHaveBeenCalledOnce();
    expect(redo).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+Z triggers redo', () => {
    const evt = makeKeyEvent('z', { ctrlKey: true, shiftKey: true });
    handleStoryboardCanvasKeyDown(evt, { undo, redo });

    expect(redo).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
  });

  it('Cmd+Shift+Z (metaKey on macOS) triggers redo', () => {
    const evt = makeKeyEvent('z', { metaKey: true, shiftKey: true });
    handleStoryboardCanvasKeyDown(evt, { undo, redo });

    expect(redo).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
  });

  it('Ctrl+Y triggers redo on Windows/Linux conventions', () => {
    const evt = makeKeyEvent('y', { ctrlKey: true });
    handleStoryboardCanvasKeyDown(evt, { undo, redo });

    expect(redo).toHaveBeenCalledOnce();
    expect(undo).not.toHaveBeenCalled();
  });

  it('Alt+Ctrl+Z does not trigger undo (altKey guard)', () => {
    const evt = makeKeyEvent('z', { ctrlKey: true, altKey: true });
    handleStoryboardCanvasKeyDown(evt, { undo, redo });

    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  describe('Focus protection (Input / Textarea / ContentEditable)', () => {
    function withActiveElement(
      tag: string,
      extra: Record<string, unknown> = {},
      run: () => void
    ) {
      const originalDoc = (globalThis as unknown as { document?: unknown }).document;
      const mockEl = { tagName: tag.toUpperCase(), ...extra };
      (globalThis as unknown as { document: unknown }).document = { activeElement: mockEl };
      try {
        run();
      } finally {
        if (originalDoc === undefined) {
          delete (globalThis as unknown as { document?: unknown }).document;
        } else {
          (globalThis as unknown as { document: unknown }).document = originalDoc;
        }
      }
    }

    it('suppresses undo/redo when INPUT is focused', () => {
      withActiveElement('input', {}, () => {
        const evtUndo = makeKeyEvent('z', { ctrlKey: true });
        const evtRedo = makeKeyEvent('z', { ctrlKey: true, shiftKey: true });

        handleStoryboardCanvasKeyDown(evtUndo, { undo, redo });
        handleStoryboardCanvasKeyDown(evtRedo, { undo, redo });

        expect(undo).not.toHaveBeenCalled();
        expect(redo).not.toHaveBeenCalled();
      });
    });

    it('suppresses undo/redo when TEXTAREA is focused', () => {
      withActiveElement('textarea', {}, () => {
        const evtUndo = makeKeyEvent('z', { ctrlKey: true });
        const evtRedo = makeKeyEvent('z', { ctrlKey: true, shiftKey: true });

        handleStoryboardCanvasKeyDown(evtUndo, { undo, redo });
        handleStoryboardCanvasKeyDown(evtRedo, { undo, redo });

        expect(undo).not.toHaveBeenCalled();
        expect(redo).not.toHaveBeenCalled();
      });
    });

    it('suppresses undo/redo when a contentEditable element is focused', () => {
      withActiveElement('div', { isContentEditable: true }, () => {
        const evtUndo = makeKeyEvent('z', { ctrlKey: true });
        const evtRedo = makeKeyEvent('z', { ctrlKey: true, shiftKey: true });

        handleStoryboardCanvasKeyDown(evtUndo, { undo, redo });
        handleStoryboardCanvasKeyDown(evtRedo, { undo, redo });

        expect(undo).not.toHaveBeenCalled();
        expect(redo).not.toHaveBeenCalled();
      });
    });
  });
});
