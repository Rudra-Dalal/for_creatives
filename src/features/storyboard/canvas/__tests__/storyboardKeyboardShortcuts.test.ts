import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StoryboardShotWithLinks, StoryboardScene } from '../../types';

/**
 * Storyboard Keyboard Shortcuts Tests
 *
 * Verifies:
 * - Undo / Redo: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y
 * - Delete / Backspace: deletes selected shot(s) or scene
 * - Duplicate: Cmd/Ctrl+D duplicates selected shot(s) and creates history entries
 * - Nudge: Arrow keys nudge selected shots (1px) or with Shift (10px) and push history
 * - Escape: Clears selection and resets tool to select
 * - Select All: Cmd/Ctrl+A selects all shots
 * - Tool keys: V, S, C, N/X, P, Shift+P, E
 * - Focus protection: input, textarea, select, contentEditable suppress shortcuts
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

interface StoryboardKeyboardHandlerOptions {
  selectedShotIds: Set<string>;
  selectedSceneId: string | null;
  allShots: StoryboardShotWithLinks[];
  scenes: StoryboardScene[];
  readOnly?: boolean;
  activeTool?: string;
  onClearSelection: () => void;
  setActiveTool: (tool: string) => void;
  cancelDrag: () => void;
  cancelPen: () => void;
  cancelErasing: () => void;
  onDuplicateShot?: (id: string) => Promise<StoryboardShotWithLinks | null>;
  onDeleteShot?: (id: string) => Promise<unknown> | void;
  onDeleteScene?: (id: string) => Promise<unknown> | void;
  onBatchUpdateShotPositions?: (updates: Array<{ id: string; x: number; y: number }>) => void;
  onUpdateScene?: (id: string, updates: Partial<StoryboardScene>) => void;
  handleZoomToFit?: () => void;
  pushAction: (action: unknown) => void;
  undo: () => void;
  redo: () => void;
  setSelectedShotIds?: (ids: Set<string>) => void;
  setSelectedSceneId?: (id: string | null) => void;
}

/**
 * Exact simulation of StoryboardCanvas's handleKeyDown listener.
 */
function handleStoryboardCanvasKeyDown(
  e: KeyboardEvent,
  opts: StoryboardKeyboardHandlerOptions
) {
  const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
  const activeTag = (activeEl?.tagName || '').toLowerCase();
  if (
    activeTag === 'input' ||
    activeTag === 'textarea' ||
    activeTag === 'select' ||
    (activeEl as HTMLElement)?.isContentEditable
  ) {
    return;
  }

  // Escape -> Deselect + cancel any active connection drag, pen stroke, or eraser gesture + switch to select tool
  if (e.key === 'Escape') {
    opts.cancelPen();
    opts.cancelErasing();
    opts.cancelDrag();
    opts.onClearSelection();
    opts.setActiveTool('select');
    return;
  }

  // Select All: Cmd/Ctrl + A
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    if (opts.allShots.length > 0) {
      opts.setSelectedShotIds?.(new Set(opts.allShots.map((s) => s.id)));
      opts.setSelectedSceneId?.(null);
    }
    return;
  }

  // Duplicate: Cmd/Ctrl + D
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    if (opts.selectedShotIds.size > 0 && opts.onDuplicateShot && !opts.readOnly) {
      const idsToDuplicate = Array.from(opts.selectedShotIds);
      void Promise.all(
        idsToDuplicate.map(async (id) => {
          const duplicated = await opts.onDuplicateShot!(id);
          if (duplicated) {
            opts.pushAction({ type: 'CREATE_SHOT', shotId: duplicated.id });
            return duplicated.id;
          }
          return null;
        })
      ).then((newIds) => {
        const validNewIds = newIds.filter((id: string | null): id is string => Boolean(id));
        if (validNewIds.length > 0) {
          opts.setSelectedShotIds?.(new Set(validNewIds));
          opts.setSelectedSceneId?.(null);
        }
      });
    }
    return;
  }

  // Delete / Backspace -> Delete selected shots or scene
  if ((e.key === 'Delete' || e.key === 'Backspace') && !opts.readOnly) {
    if (opts.selectedShotIds.size > 0 && opts.onDeleteShot) {
      e.preventDefault();
      const shotIdsToDelete = Array.from(opts.selectedShotIds);
      if (shotIdsToDelete.length === 1) {
        opts.pushAction({ type: 'DELETE_SHOT', shotId: shotIdsToDelete[0] });
      } else {
        opts.pushAction({ type: 'BATCH_DELETE_SHOTS', shotIds: shotIdsToDelete });
      }
      for (const id of shotIdsToDelete) {
        opts.onDeleteShot(id);
      }
      opts.setSelectedShotIds?.(new Set());
    } else if (opts.selectedSceneId && opts.onDeleteScene) {
      e.preventDefault();
      opts.pushAction({ type: 'DELETE_SCENE', sceneId: opts.selectedSceneId });
      opts.onDeleteScene(opts.selectedSceneId);
      opts.setSelectedSceneId?.(null);
    }
    return;
  }

  // Arrow Key Nudges: 1px or 10px with Shift
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;

    if (opts.selectedShotIds.size > 0 && opts.onBatchUpdateShotPositions && !opts.readOnly) {
      const before: Array<{ id: string; x: number; y: number }> = [];
      const after: Array<{ id: string; x: number; y: number }> = [];

      for (const id of opts.selectedShotIds) {
        const s = opts.allShots.find((shot) => shot.id === id);
        if (s) {
          before.push({ id, x: s.x, y: s.y });
          after.push({ id, x: s.x + dx, y: s.y + dy });
        }
      }

      if (after.length > 0) {
        opts.pushAction({ type: 'MOVE_SHOTS', before, after });
        opts.onBatchUpdateShotPositions(after);
      }
    } else if (opts.selectedSceneId && opts.onUpdateScene && !opts.readOnly) {
      const scene = opts.scenes.find((s) => s.id === opts.selectedSceneId);
      if (scene) {
        const before = { x: scene.x, y: scene.y };
        const after = { x: scene.x + dx, y: scene.y + dy };
        opts.pushAction({
          type: 'MOVE_SCENE',
          sceneId: opts.selectedSceneId,
          before,
          after,
        });
        opts.onUpdateScene(opts.selectedSceneId, after);
      }
    }
    return;
  }

  // Tool shortcuts (V, S, C, N/X, Z, P, E / Shift+P)
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'v') { opts.cancelDrag(); opts.cancelPen(); opts.cancelErasing(); opts.setActiveTool('select'); }
    else if (key === 's') { opts.cancelDrag(); opts.cancelPen(); opts.cancelErasing(); opts.setActiveTool('shot'); }
    else if (key === 'c') { opts.cancelDrag(); opts.cancelPen(); opts.cancelErasing(); opts.setActiveTool('scene'); }
    else if (key === 'n' || key === 'x') { opts.cancelPen(); opts.cancelErasing(); opts.setActiveTool('connect'); }
    else if (key === 'p') {
      if (e.shiftKey) {
        if (opts.activeTool !== 'eraser') {
          opts.cancelDrag();
          opts.cancelPen();
          opts.setActiveTool('eraser');
        }
      } else {
        if (opts.activeTool !== 'pen') {
          opts.cancelDrag();
          opts.cancelErasing();
          opts.setActiveTool('pen');
        }
      }
    }
    else if (key === 'e') {
      if (opts.activeTool !== 'eraser') {
        opts.cancelDrag();
        opts.cancelPen();
        opts.setActiveTool('eraser');
      }
    }
    else if (key === 'z' || (e.shiftKey && key === '!')) {
      opts.handleZoomToFit?.();
    }
  }

  // Undo / Redo
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

describe('Storyboard Keyboard Shortcuts', () => {
  let defaultOptions: StoryboardKeyboardHandlerOptions;

  const mockShot1: StoryboardShotWithLinks = {
    id: 'shot-1',
    scene_id: 'scene-1',
    project_id: 'proj-1',
    shot_number: '1',
    title: 'Shot 1',
    description: '',
    dialogue: '',
    aspect_ratio: '16:9',
    shot_type: 'wide',
    camera_movement: 'static',
    visual_url: '',
    visual_source: 'none',
    sketch_data: null,
    x: 100,
    y: 200,
    width: 240,
    height: 160,
    z_index: 1,
    display_order: 0,
    created_at: '2026-10-16T00:00:00Z',
    updated_at: '2026-10-16T00:00:00Z',
    deleted_at: null,
    references: [],
    direction_notes: [],
  };

  const mockShot2: StoryboardShotWithLinks = {
    ...mockShot1,
    id: 'shot-2',
    shot_number: '2',
    x: 400,
    y: 200,
  };

  const mockScene: StoryboardScene = {
    id: 'scene-1',
    project_id: 'proj-1',
    title: 'Opening Scene',
    description: '',
    display_order: 0,
    x: 50,
    y: 50,
    width: 600,
    height: 400,
    created_at: '2026-10-16T00:00:00Z',
    updated_at: '2026-10-16T00:00:00Z',
    deleted_at: null,
  };

  beforeEach(() => {
    defaultOptions = {
      selectedShotIds: new Set(),
      selectedSceneId: null,
      allShots: [mockShot1, mockShot2],
      scenes: [mockScene],
      readOnly: false,
      activeTool: 'select',
      onClearSelection: vi.fn(),
      setActiveTool: vi.fn(),
      cancelDrag: vi.fn(),
      cancelPen: vi.fn(),
      cancelErasing: vi.fn(),
      onDuplicateShot: vi.fn().mockResolvedValue({ ...mockShot1, id: 'dup-1' }),
      onDeleteShot: vi.fn(),
      onDeleteScene: vi.fn(),
      onBatchUpdateShotPositions: vi.fn(),
      onUpdateScene: vi.fn(),
      handleZoomToFit: vi.fn(),
      pushAction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      setSelectedShotIds: vi.fn(),
      setSelectedSceneId: vi.fn(),
    };
  });

  describe('Undo / Redo', () => {
    it('Ctrl+Z triggers undo and calls preventDefault', () => {
      const evt = makeKeyEvent('z', { ctrlKey: true });
      handleStoryboardCanvasKeyDown(evt, defaultOptions);

      expect(defaultOptions.undo).toHaveBeenCalledOnce();
      expect(defaultOptions.redo).not.toHaveBeenCalled();
      expect(evt.preventDefault).toHaveBeenCalledOnce();
    });

    it('Cmd+Z (metaKey on macOS) triggers undo', () => {
      const evt = makeKeyEvent('z', { metaKey: true });
      handleStoryboardCanvasKeyDown(evt, defaultOptions);

      expect(defaultOptions.undo).toHaveBeenCalledOnce();
    });

    it('Ctrl+Shift+Z triggers redo', () => {
      const evt = makeKeyEvent('z', { ctrlKey: true, shiftKey: true });
      handleStoryboardCanvasKeyDown(evt, defaultOptions);

      expect(defaultOptions.redo).toHaveBeenCalledOnce();
      expect(defaultOptions.undo).not.toHaveBeenCalled();
    });

    it('Cmd+Shift+Z triggers redo', () => {
      const evt = makeKeyEvent('z', { metaKey: true, shiftKey: true });
      handleStoryboardCanvasKeyDown(evt, defaultOptions);

      expect(defaultOptions.redo).toHaveBeenCalledOnce();
    });

    it('Ctrl+Y triggers redo', () => {
      const evt = makeKeyEvent('y', { ctrlKey: true });
      handleStoryboardCanvasKeyDown(evt, defaultOptions);

      expect(defaultOptions.redo).toHaveBeenCalledOnce();
    });

    it('Alt+Ctrl+Z does not trigger undo (altKey guard)', () => {
      const evt = makeKeyEvent('z', { ctrlKey: true, altKey: true });
      handleStoryboardCanvasKeyDown(evt, defaultOptions);

      expect(defaultOptions.undo).not.toHaveBeenCalled();
    });
  });

  describe('Escape key (Deselect & Tool Reset)', () => {
    it('Escape cancels active interactions and resets tool to select', () => {
      const evt = makeKeyEvent('Escape');
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        activeTool: 'pen',
      });

      expect(defaultOptions.cancelPen).toHaveBeenCalledOnce();
      expect(defaultOptions.cancelErasing).toHaveBeenCalledOnce();
      expect(defaultOptions.cancelDrag).toHaveBeenCalledOnce();
      expect(defaultOptions.onClearSelection).toHaveBeenCalledOnce();
      expect(defaultOptions.setActiveTool).toHaveBeenCalledWith('select');
    });
  });

  describe('Delete / Backspace', () => {
    it('deletes a single selected shot and pushes DELETE_SHOT to history', () => {
      const evt = makeKeyEvent('Delete');
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedShotIds: new Set(['shot-1']),
      });

      expect(defaultOptions.onDeleteShot).toHaveBeenCalledWith('shot-1');
      expect(defaultOptions.pushAction).toHaveBeenCalledWith({
        type: 'DELETE_SHOT',
        shotId: 'shot-1',
      });
      expect(defaultOptions.setSelectedShotIds).toHaveBeenCalledWith(new Set());
    });

    it('deletes multiple selected shots and pushes BATCH_DELETE_SHOTS to history', () => {
      const evt = makeKeyEvent('Backspace');
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedShotIds: new Set(['shot-1', 'shot-2']),
      });

      expect(defaultOptions.onDeleteShot).toHaveBeenCalledWith('shot-1');
      expect(defaultOptions.onDeleteShot).toHaveBeenCalledWith('shot-2');
      expect(defaultOptions.pushAction).toHaveBeenCalledWith({
        type: 'BATCH_DELETE_SHOTS',
        shotIds: ['shot-1', 'shot-2'],
      });
    });

    it('deletes a selected scene and pushes DELETE_SCENE to history', () => {
      const evt = makeKeyEvent('Delete');
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedSceneId: 'scene-1',
      });

      expect(defaultOptions.onDeleteScene).toHaveBeenCalledWith('scene-1');
      expect(defaultOptions.pushAction).toHaveBeenCalledWith({
        type: 'DELETE_SCENE',
        sceneId: 'scene-1',
      });
      expect(defaultOptions.setSelectedSceneId).toHaveBeenCalledWith(null);
    });

    it('does not delete when readOnly is true', () => {
      const evt = makeKeyEvent('Delete');
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedShotIds: new Set(['shot-1']),
        readOnly: true,
      });

      expect(defaultOptions.onDeleteShot).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate (Cmd/Ctrl + D)', () => {
    it('duplicates selected shot and pushes CREATE_SHOT to history', async () => {
      const evt = makeKeyEvent('d', { ctrlKey: true });
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedShotIds: new Set(['shot-1']),
      });

      expect(defaultOptions.onDuplicateShot).toHaveBeenCalledWith('shot-1');
      await vi.waitFor(() => {
        expect(defaultOptions.pushAction).toHaveBeenCalledWith({
          type: 'CREATE_SHOT',
          shotId: 'dup-1',
        });
        expect(defaultOptions.setSelectedShotIds).toHaveBeenCalledWith(new Set(['dup-1']));
      });
    });

    it('does not duplicate in readOnly mode', () => {
      const evt = makeKeyEvent('d', { metaKey: true });
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedShotIds: new Set(['shot-1']),
        readOnly: true,
      });

      expect(defaultOptions.onDuplicateShot).not.toHaveBeenCalled();
    });
  });

  describe('Nudge (Arrow keys)', () => {
    it('nudges selected shot by 1px with ArrowRight and pushes MOVE_SHOTS', () => {
      const evt = makeKeyEvent('ArrowRight');
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedShotIds: new Set(['shot-1']),
      });

      expect(defaultOptions.onBatchUpdateShotPositions).toHaveBeenCalledWith([
        { id: 'shot-1', x: 101, y: 200 },
      ]);
      expect(defaultOptions.pushAction).toHaveBeenCalledWith({
        type: 'MOVE_SHOTS',
        before: [{ id: 'shot-1', x: 100, y: 200 }],
        after: [{ id: 'shot-1', x: 101, y: 200 }],
      });
    });

    it('nudges selected shot by 10px with Shift + ArrowDown', () => {
      const evt = makeKeyEvent('ArrowDown', { shiftKey: true });
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedShotIds: new Set(['shot-1']),
      });

      expect(defaultOptions.onBatchUpdateShotPositions).toHaveBeenCalledWith([
        { id: 'shot-1', x: 100, y: 210 },
      ]);
      expect(defaultOptions.pushAction).toHaveBeenCalledWith({
        type: 'MOVE_SHOTS',
        before: [{ id: 'shot-1', x: 100, y: 200 }],
        after: [{ id: 'shot-1', x: 100, y: 210 }],
      });
    });

    it('nudges selected scene by 10px with Shift + ArrowLeft and pushes MOVE_SCENE', () => {
      const evt = makeKeyEvent('ArrowLeft', { shiftKey: true });
      handleStoryboardCanvasKeyDown(evt, {
        ...defaultOptions,
        selectedSceneId: 'scene-1',
      });

      expect(defaultOptions.onUpdateScene).toHaveBeenCalledWith('scene-1', {
        x: 40,
        y: 50,
      });
      expect(defaultOptions.pushAction).toHaveBeenCalledWith({
        type: 'MOVE_SCENE',
        sceneId: 'scene-1',
        before: { x: 50, y: 50 },
        after: { x: 40, y: 50 },
      });
    });
  });

  describe('Select All (Cmd/Ctrl + A)', () => {
    it('selects all shots on the board', () => {
      const evt = makeKeyEvent('a', { ctrlKey: true });
      handleStoryboardCanvasKeyDown(evt, defaultOptions);

      expect(defaultOptions.setSelectedShotIds).toHaveBeenCalledWith(
        new Set(['shot-1', 'shot-2'])
      );
      expect(defaultOptions.setSelectedSceneId).toHaveBeenCalledWith(null);
    });
  });

  describe('Tool switching shortcuts', () => {
    it('presses V switches to select tool', () => {
      const evt = makeKeyEvent('v');
      handleStoryboardCanvasKeyDown(evt, defaultOptions);
      expect(defaultOptions.setActiveTool).toHaveBeenCalledWith('select');
    });

    it('presses S switches to shot placement tool', () => {
      const evt = makeKeyEvent('s');
      handleStoryboardCanvasKeyDown(evt, defaultOptions);
      expect(defaultOptions.setActiveTool).toHaveBeenCalledWith('shot');
    });

    it('presses C switches to scene creation tool', () => {
      const evt = makeKeyEvent('c');
      handleStoryboardCanvasKeyDown(evt, defaultOptions);
      expect(defaultOptions.setActiveTool).toHaveBeenCalledWith('scene');
    });

    it('presses N or X switches to connector tool', () => {
      const evt = makeKeyEvent('n');
      handleStoryboardCanvasKeyDown(evt, defaultOptions);
      expect(defaultOptions.setActiveTool).toHaveBeenCalledWith('connect');
    });

    it('presses P switches to pen tool', () => {
      const evt = makeKeyEvent('p');
      handleStoryboardCanvasKeyDown(evt, defaultOptions);
      expect(defaultOptions.setActiveTool).toHaveBeenCalledWith('pen');
    });

    it('presses Shift+P switches to eraser tool', () => {
      const evt = makeKeyEvent('p', { shiftKey: true });
      handleStoryboardCanvasKeyDown(evt, defaultOptions);
      expect(defaultOptions.setActiveTool).toHaveBeenCalledWith('eraser');
    });

    it('presses E switches to eraser tool', () => {
      const evt = makeKeyEvent('e');
      handleStoryboardCanvasKeyDown(evt, defaultOptions);
      expect(defaultOptions.setActiveTool).toHaveBeenCalledWith('eraser');
    });
  });

  describe('Focus protection', () => {
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

    it('suppresses shortcuts when INPUT is focused', () => {
      withActiveElement('input', {}, () => {
        const evt = makeKeyEvent('z', { ctrlKey: true });
        handleStoryboardCanvasKeyDown(evt, defaultOptions);
        expect(defaultOptions.undo).not.toHaveBeenCalled();
      });
    });

    it('suppresses shortcuts when TEXTAREA is focused', () => {
      withActiveElement('textarea', {}, () => {
        const evt = makeKeyEvent('Delete');
        handleStoryboardCanvasKeyDown(evt, {
          ...defaultOptions,
          selectedShotIds: new Set(['shot-1']),
        });
        expect(defaultOptions.onDeleteShot).not.toHaveBeenCalled();
      });
    });

    it('suppresses shortcuts when SELECT dropdown is focused', () => {
      withActiveElement('select', {}, () => {
        const evt = makeKeyEvent('d', { ctrlKey: true });
        handleStoryboardCanvasKeyDown(evt, {
          ...defaultOptions,
          selectedShotIds: new Set(['shot-1']),
        });
        expect(defaultOptions.onDuplicateShot).not.toHaveBeenCalled();
      });
    });

    it('suppresses shortcuts when contentEditable element is focused', () => {
      withActiveElement('div', { isContentEditable: true }, () => {
        const evt = makeKeyEvent('ArrowRight');
        handleStoryboardCanvasKeyDown(evt, {
          ...defaultOptions,
          selectedShotIds: new Set(['shot-1']),
        });
        expect(defaultOptions.onBatchUpdateShotPositions).not.toHaveBeenCalled();
      });
    });
  });
});
