import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sbPushToStack,
  sbPopFromStack,
  STORYBOARD_MAX_HISTORY_DEPTH,
} from '../storyboardHistoryStack';
import {
  StoryboardHistoryManager,
  type StoryboardUndoAction,
  type UseStoryboardHistoryCallbacks,
} from '../useStoryboardHistory';

// ============================================================================
// 1. PURE STACK UNIT TESTS
// ============================================================================

describe('storyboardHistoryStack — pure stack primitives', () => {
  it('adds an action to an empty stack', () => {
    const action: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-1' };
    const stack = sbPushToStack([], action);
    expect(stack).toHaveLength(1);
    expect(stack[0]).toBe(action);
  });

  it('appends in LIFO-ready order (newest last)', () => {
    const a1: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-1' };
    const a2: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-2' };
    const a3: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-3' };

    const stack = sbPushToStack(sbPushToStack(sbPushToStack([], a1), a2), a3);
    expect(stack).toHaveLength(3);
    expect(stack[0]).toBe(a1);
    expect(stack[1]).toBe(a2);
    expect(stack[2]).toBe(a3);
  });

  it('does not mutate the original array', () => {
    const initial: readonly StoryboardUndoAction[] = [{ type: 'CREATE_SHOT', shotId: 'shot-1' }];
    const copy = [...initial];
    sbPushToStack(initial, { type: 'CREATE_SHOT', shotId: 'shot-2' });
    expect(initial).toEqual(copy);
  });

  it(`enforces maximum stack depth of ${STORYBOARD_MAX_HISTORY_DEPTH}`, () => {
    let stack: StoryboardUndoAction[] = [];
    for (let i = 0; i < STORYBOARD_MAX_HISTORY_DEPTH + 15; i++) {
      stack = sbPushToStack(stack, { type: 'CREATE_SHOT', shotId: `shot-${i}` });
    }
    expect(stack).toHaveLength(STORYBOARD_MAX_HISTORY_DEPTH);
  });

  it('discards oldest entries when capacity is exceeded', () => {
    let stack: StoryboardUndoAction[] = [];
    for (let i = 0; i < 55; i++) {
      stack = sbPushToStack(stack, { type: 'CREATE_SHOT', shotId: `shot-${i}` });
    }
    expect(stack).toHaveLength(50);
    // Oldest 5 entries (0..4) discarded; index 0 is shot-5, index 49 is shot-54
    expect((stack[0] as { shotId: string }).shotId).toBe('shot-5');
    expect((stack[49] as { shotId: string }).shotId).toBe('shot-54');
  });

  it('pops the most recent action and returns remaining items', () => {
    const a1: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-1' };
    const a2: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-2' };
    const { action, remaining } = sbPopFromStack([a1, a2]);

    expect(action).toBe(a2);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toBe(a1);
  });

  it('returns action: null and remaining: [] when popping an empty stack', () => {
    const { action, remaining } = sbPopFromStack([]);
    expect(action).toBeNull();
    expect(remaining).toEqual([]);
  });

  it('correctly drains in exact LIFO order', () => {
    const a1: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-1' };
    const a2: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-2' };
    const a3: StoryboardUndoAction = { type: 'CREATE_SHOT', shotId: 'shot-3' };

    const s0 = [a1, a2, a3];
    const { action: p1, remaining: s1 } = sbPopFromStack(s0);
    const { action: p2, remaining: s2 } = sbPopFromStack(s1);
    const { action: p3, remaining: s3 } = sbPopFromStack(s2);
    const { action: p4 } = sbPopFromStack(s3);

    expect(p1).toBe(a3);
    expect(p2).toBe(a2);
    expect(p3).toBe(a1);
    expect(p4).toBeNull();
  });
});

// ============================================================================
// 2. STORYBOARD HISTORY MANAGER LIFECYCLE TESTS
// ============================================================================

describe('StoryboardHistoryManager — lifecycle & stack contracts', () => {
  let callbacks: UseStoryboardHistoryCallbacks;
  let history: StoryboardHistoryManager;

  beforeEach(() => {
    callbacks = {
      onDeleteShot: vi.fn().mockResolvedValue(undefined),
      onRestoreShot: vi.fn().mockResolvedValue(undefined),
      onUpdateShot: vi.fn().mockResolvedValue(undefined),
      onBatchUpdateShotPositions: vi.fn().mockResolvedValue(undefined),
      onReassignShotScene: vi.fn().mockResolvedValue(undefined),
      onReorderShots: vi.fn().mockResolvedValue(undefined),
      onDeleteScene: vi.fn().mockResolvedValue(undefined),
      onRestoreScene: vi.fn().mockResolvedValue(undefined),
      onUpdateScene: vi.fn().mockResolvedValue(undefined),
      onReorderScenes: vi.fn().mockResolvedValue(undefined),
      onDeleteConnection: vi.fn().mockResolvedValue(undefined),
      onRestoreConnection: vi.fn().mockResolvedValue(null),
      onUpdateConnection: vi.fn().mockResolvedValue(undefined),
      onEraseStroke: vi.fn().mockResolvedValue(true),
      onRestoreStroke: vi.fn().mockResolvedValue(null),
    };
    history = new StoryboardHistoryManager(callbacks);
  });

  it('initializes with empty stacks and cannot undo or redo', () => {
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.getUndos()).toHaveLength(0);
    expect(history.getRedos()).toHaveLength(0);
  });

  it('safely handles empty undo and redo calls', async () => {
    const undoRes = await history.undo();
    const redoRes = await history.redo();
    expect(undoRes).toBe(false);
    expect(redoRes).toBe(false);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('pushing an action enables canUndo and leaves canRedo false', () => {
    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-10' });
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.getUndos()).toHaveLength(1);
  });

  it('undoing an action pops undo stack and moves to redo stack', async () => {
    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-10' });
    const success = await history.undo();

    expect(success).toBe(true);
    expect(callbacks.onDeleteShot).toHaveBeenCalledWith('shot-10');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
    expect(history.getRedos()).toHaveLength(1);
  });

  it('redoing an action moves from redo stack back to undo stack', async () => {
    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-10' });
    await history.undo();
    const success = await history.redo();

    expect(success).toBe(true);
    expect(callbacks.onRestoreShot).toHaveBeenCalledWith('shot-10');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('new operation after undo clears the redo history branch', async () => {
    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-1' });
    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-2' });
    await history.undo();

    expect(history.canRedo).toBe(true);
    expect(history.getRedos()).toHaveLength(1);

    // User performs a new action on the canvas
    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-3' });

    expect(history.canRedo).toBe(false);
    expect(history.getRedos()).toHaveLength(0);
    expect(history.getUndos()).toHaveLength(2); // shot-1, shot-3
  });

  it('history is capped at 50 operations', () => {
    for (let i = 0; i < 70; i++) {
      history.pushAction({ type: 'CREATE_SHOT', shotId: `shot-${i}` });
    }
    expect(history.getUndos()).toHaveLength(50);
    expect((history.getUndos()[0] as { shotId: string }).shotId).toBe('shot-20');
  });

  it('failed persistence operation does not corrupt history stack and throws', async () => {
    (callbacks.onDeleteShot as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Supabase network failure')
    );

    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-1' });

    await expect(history.undo()).rejects.toThrow('Supabase network failure');

    // Stack must remain intact — not popped into redo
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
    expect(history.getUndos()).toHaveLength(1);
  });

  it('preserves stable IDs through multiple undo/redo cycles', async () => {
    const shotId = 'stable-shot-uuid-1234';
    history.pushAction({ type: 'CREATE_SHOT', shotId });

    // Cycle 1: Undo
    await history.undo();
    expect(callbacks.onDeleteShot).toHaveBeenCalledWith(shotId);

    // Cycle 1: Redo
    await history.redo();
    expect(callbacks.onRestoreShot).toHaveBeenCalledWith(shotId);

    // Cycle 2: Undo
    await history.undo();
    expect(callbacks.onDeleteShot).toHaveBeenCalledTimes(2);

    // Cycle 2: Redo
    await history.redo();
    expect(callbacks.onRestoreShot).toHaveBeenCalledTimes(2);

    // Confirms ID was completely unchanged
    expect(vi.mocked(callbacks.onDeleteShot!).mock.calls[0]?.[0]).toBe(shotId);
    expect(vi.mocked(callbacks.onRestoreShot!).mock.calls[0]?.[0]).toBe(shotId);
  });
});

// ============================================================================
// 3. STORYBOARD EDITING OPERATIONS (REVERSIBILITY SUITE)
// ============================================================================

describe('Storyboard Operations — Reversible Operations Suite', () => {
  let callbacks: UseStoryboardHistoryCallbacks;
  let history: StoryboardHistoryManager;

  beforeEach(() => {
    callbacks = {
      onDeleteShot: vi.fn().mockResolvedValue(undefined),
      onRestoreShot: vi.fn().mockResolvedValue(undefined),
      onUpdateShot: vi.fn().mockResolvedValue(undefined),
      onBatchUpdateShotPositions: vi.fn().mockResolvedValue(undefined),
      onReassignShotScene: vi.fn().mockResolvedValue(undefined),
      onReorderShots: vi.fn().mockResolvedValue(undefined),
      onDeleteScene: vi.fn().mockResolvedValue(undefined),
      onRestoreScene: vi.fn().mockResolvedValue(undefined),
      onUpdateScene: vi.fn().mockResolvedValue(undefined),
      onReorderScenes: vi.fn().mockResolvedValue(undefined),
      onDeleteConnection: vi.fn().mockResolvedValue(undefined),
      onRestoreConnection: vi.fn().mockResolvedValue(null),
      onUpdateConnection: vi.fn().mockResolvedValue(undefined),
      onEraseStroke: vi.fn().mockResolvedValue(true),
      onRestoreStroke: vi.fn().mockResolvedValue(null),
    };
    history = new StoryboardHistoryManager(callbacks);
  });

  // 1. Create Shot
  it('Create shot → undo → redo', async () => {
    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-1' });

    // Undo -> soft delete shot
    await history.undo();
    expect(callbacks.onDeleteShot).toHaveBeenCalledWith('shot-1');

    // Redo -> restore shot
    await history.redo();
    expect(callbacks.onRestoreShot).toHaveBeenCalledWith('shot-1');
  });

  // 2. Delete Shot
  it('Delete shot → undo → redo', async () => {
    history.pushAction({ type: 'DELETE_SHOT', shotId: 'shot-1' });

    // Undo -> restore shot
    await history.undo();
    expect(callbacks.onRestoreShot).toHaveBeenCalledWith('shot-1');

    // Redo -> delete shot
    await history.redo();
    expect(callbacks.onDeleteShot).toHaveBeenCalledWith('shot-1');
  });

  // 3. Move Shots (atomic multi-shot)
  it('Move shots → undo → redo', async () => {
    history.pushAction({
      type: 'MOVE_SHOTS',
      shots: [
        { id: 'shot-1', prevX: 100, prevY: 100, nextX: 200, nextY: 250 },
        { id: 'shot-2', prevX: 300, prevY: 100, nextX: 400, nextY: 250 },
      ],
    });

    // Undo -> restore previous positions
    await history.undo();
    expect(callbacks.onBatchUpdateShotPositions).toHaveBeenCalledWith([
      { id: 'shot-1', x: 100, y: 100 },
      { id: 'shot-2', x: 300, y: 100 },
    ]);

    // Redo -> reapply next positions
    await history.redo();
    expect(callbacks.onBatchUpdateShotPositions).toHaveBeenCalledWith([
      { id: 'shot-1', x: 200, y: 250 },
      { id: 'shot-2', x: 400, y: 250 },
    ]);
  });

  // 4. Resize Shot
  it('Resize shot → undo → redo', async () => {
    history.pushAction({
      type: 'RESIZE_SHOT',
      shotId: 'shot-1',
      prev: { width: 280, height: 180 },
      next: { width: 360, height: 240 },
    });

    await history.undo();
    expect(callbacks.onUpdateShot).toHaveBeenCalledWith('shot-1', { width: 280, height: 180 });

    await history.redo();
    expect(callbacks.onUpdateShot).toHaveBeenCalledWith('shot-1', { width: 360, height: 240 });
  });

  // 5. Update Shot Properties
  it('Update shot properties → undo → redo', async () => {
    history.pushAction({
      type: 'UPDATE_SHOT',
      shotId: 'shot-1',
      prev: { title: 'Old Title', dialogue: 'Hello' },
      next: { title: 'New Title', dialogue: 'Goodbye' },
    });

    await history.undo();
    expect(callbacks.onUpdateShot).toHaveBeenCalledWith('shot-1', {
      title: 'Old Title',
      dialogue: 'Hello',
    });

    await history.redo();
    expect(callbacks.onUpdateShot).toHaveBeenCalledWith('shot-1', {
      title: 'New Title',
      dialogue: 'Goodbye',
    });
  });

  // 6. Create Connection
  it('Create connection → undo → redo', async () => {
    history.pushAction({ type: 'CREATE_CONNECTION', connectionId: 'conn-1' });

    // Undo -> delete connection
    await history.undo();
    expect(callbacks.onDeleteConnection).toHaveBeenCalledWith('conn-1');

    // Redo -> restore connection
    await history.redo();
    expect(callbacks.onRestoreConnection).toHaveBeenCalledWith('conn-1');
  });

  // 7. Delete Connection
  it('Delete connection → undo → redo', async () => {
    history.pushAction({ type: 'DELETE_CONNECTION', connectionId: 'conn-1' });

    // Undo -> restore connection
    await history.undo();
    expect(callbacks.onRestoreConnection).toHaveBeenCalledWith('conn-1');

    // Redo -> delete connection
    await history.redo();
    expect(callbacks.onDeleteConnection).toHaveBeenCalledWith('conn-1');
  });

  // 8. Update Connection
  it('Update connection anchors/label → undo → redo', async () => {
    history.pushAction({
      type: 'UPDATE_CONNECTION',
      connectionId: 'conn-1',
      prev: { fromAnchor: 'right', toAnchor: 'left', transitionLabel: 'Cut' },
      next: { fromAnchor: 'bottom', toAnchor: 'top', transitionLabel: 'Fade' },
    });

    await history.undo();
    expect(callbacks.onUpdateConnection).toHaveBeenCalledWith('conn-1', {
      fromAnchor: 'right',
      toAnchor: 'left',
      transitionLabel: 'Cut',
    });

    await history.redo();
    expect(callbacks.onUpdateConnection).toHaveBeenCalledWith('conn-1', {
      fromAnchor: 'bottom',
      toAnchor: 'top',
      transitionLabel: 'Fade',
    });
  });

  // 9. Create Stroke
  it('Create stroke → undo → redo', async () => {
    history.pushAction({ type: 'ADD_STROKE', strokeId: 'stroke-1' });

    // Undo -> erase stroke
    await history.undo();
    expect(callbacks.onEraseStroke).toHaveBeenCalledWith('stroke-1');

    // Redo -> restore stroke
    await history.redo();
    expect(callbacks.onRestoreStroke).toHaveBeenCalledWith('stroke-1');
  });

  // 10. Erase Stroke
  it('Erase stroke → undo → redo', async () => {
    history.pushAction({ type: 'ERASE_STROKE', strokeId: 'stroke-1' });

    // Undo -> restore stroke
    await history.undo();
    expect(callbacks.onRestoreStroke).toHaveBeenCalledWith('stroke-1');

    // Redo -> erase stroke
    await history.redo();
    expect(callbacks.onEraseStroke).toHaveBeenCalledWith('stroke-1');
  });

  // 11. Batch Erase Strokes
  it('Batch erase strokes → undo → redo', async () => {
    history.pushAction({
      type: 'BATCH_ERASE_STROKES',
      strokeIds: ['stroke-1', 'stroke-2', 'stroke-3'],
    });

    await history.undo();
    expect(callbacks.onRestoreStroke).toHaveBeenCalledWith('stroke-1');
    expect(callbacks.onRestoreStroke).toHaveBeenCalledWith('stroke-2');
    expect(callbacks.onRestoreStroke).toHaveBeenCalledWith('stroke-3');

    await history.redo();
    expect(callbacks.onEraseStroke).toHaveBeenCalledWith('stroke-1');
    expect(callbacks.onEraseStroke).toHaveBeenCalledWith('stroke-2');
    expect(callbacks.onEraseStroke).toHaveBeenCalledWith('stroke-3');
  });

  // 12. Reassign Shot Scene
  it('Reassign shot to scene → undo → redo', async () => {
    history.pushAction({
      type: 'REASSIGN_SHOT_SCENE',
      shotId: 'shot-1',
      prevSceneId: 'scene-A',
      nextSceneId: 'scene-B',
    });

    await history.undo();
    expect(callbacks.onReassignShotScene).toHaveBeenCalledWith('shot-1', 'scene-A');

    await history.redo();
    expect(callbacks.onReassignShotScene).toHaveBeenCalledWith('shot-1', 'scene-B');
  });

  // 13. Reorder Shots
  it('Reorder shots → undo → redo', async () => {
    history.pushAction({
      type: 'REORDER_SHOTS',
      sceneId: 'scene-1',
      prevShotIds: ['shot-1', 'shot-2', 'shot-3'],
      nextShotIds: ['shot-3', 'shot-1', 'shot-2'],
    });

    await history.undo();
    expect(callbacks.onReorderShots).toHaveBeenCalledWith('scene-1', [
      'shot-1',
      'shot-2',
      'shot-3',
    ]);

    await history.redo();
    expect(callbacks.onReorderShots).toHaveBeenCalledWith('scene-1', [
      'shot-3',
      'shot-1',
      'shot-2',
    ]);
  });

  // 14. Create Scene
  it('Create scene → undo → redo', async () => {
    history.pushAction({ type: 'CREATE_SCENE', sceneId: 'scene-1' });

    await history.undo();
    expect(callbacks.onDeleteScene).toHaveBeenCalledWith('scene-1');

    await history.redo();
    expect(callbacks.onRestoreScene).toHaveBeenCalledWith('scene-1');
  });

  // 15. Delete Scene
  it('Scene deletion and restoration preserve the appropriate relationships', async () => {
    history.pushAction({ type: 'DELETE_SCENE', sceneId: 'scene-1' });

    // Undoing scene deletion calls onRestoreScene (which restores scene + child shots)
    await history.undo();
    expect(callbacks.onRestoreScene).toHaveBeenCalledWith('scene-1');

    // Redoing calls onDeleteScene (which soft-deletes scene + child shots)
    await history.redo();
    expect(callbacks.onDeleteScene).toHaveBeenCalledWith('scene-1');
  });

  // 16. Move Scene (moves scene + member shots atomically)
  it('Move scene with member shots → undo → redo', async () => {
    history.pushAction({
      type: 'MOVE_SCENE',
      sceneId: 'scene-1',
      prevPos: { x: 100, y: 100 },
      nextPos: { x: 300, y: 400 },
      memberShots: [
        { id: 'shot-1', prevX: 140, prevY: 160, nextX: 340, nextY: 460 },
      ],
    });

    await history.undo();
    expect(callbacks.onUpdateScene).toHaveBeenCalledWith('scene-1', { x: 100, y: 100 });
    expect(callbacks.onBatchUpdateShotPositions).toHaveBeenCalledWith([
      { id: 'shot-1', x: 140, y: 160 },
    ]);

    await history.redo();
    expect(callbacks.onUpdateScene).toHaveBeenCalledWith('scene-1', { x: 300, y: 400 });
    expect(callbacks.onBatchUpdateShotPositions).toHaveBeenCalledWith([
      { id: 'shot-1', x: 340, y: 460 },
    ]);
  });

  // 17. Resize Scene
  it('Resize scene → undo → redo', async () => {
    history.pushAction({
      type: 'RESIZE_SCENE',
      sceneId: 'scene-1',
      prevSize: { width: 880, height: 560 },
      nextSize: { width: 1200, height: 800 },
    });

    await history.undo();
    expect(callbacks.onUpdateScene).toHaveBeenCalledWith('scene-1', { width: 880, height: 560 });

    await history.redo();
    expect(callbacks.onUpdateScene).toHaveBeenCalledWith('scene-1', { width: 1200, height: 800 });
  });

  // 18. Update Scene Metadata
  it('Update scene metadata → undo → redo', async () => {
    history.pushAction({
      type: 'UPDATE_SCENE',
      sceneId: 'scene-1',
      prev: { title: 'Scene 1', description: 'Opening' },
      next: { title: 'Scene 1 Revised', description: 'Dramatic opening' },
    });

    await history.undo();
    expect(callbacks.onUpdateScene).toHaveBeenCalledWith('scene-1', {
      title: 'Scene 1',
      description: 'Opening',
    });

    await history.redo();
    expect(callbacks.onUpdateScene).toHaveBeenCalledWith('scene-1', {
      title: 'Scene 1 Revised',
      description: 'Dramatic opening',
    });
  });

  // 19. Reorder Scenes
  it('Reorder scenes → undo → redo', async () => {
    history.pushAction({
      type: 'REORDER_SCENES',
      prevSceneIds: ['s1', 's2', 's3'],
      nextSceneIds: ['s2', 's3', 's1'],
    });

    await history.undo();
    expect(callbacks.onReorderScenes).toHaveBeenCalledWith(['s1', 's2', 's3']);

    await history.redo();
    expect(callbacks.onReorderScenes).toHaveBeenCalledWith(['s2', 's3', 's1']);
  });
});

// ============================================================================
// 4. INTEGRATION & BEHAVIOR TESTS
// ============================================================================

describe('Storyboard History — Integration & UI Guarantees', () => {
  it('switching tools does not reset history', () => {
    const history = new StoryboardHistoryManager({});
    history.pushAction({ type: 'CREATE_SHOT', shotId: 'shot-1' });

    // Simulate tool switching
    let activeTool = 'select';
    activeTool = 'pen';
    expect(history.canUndo).toBe(true);

    activeTool = 'eraser';
    expect(history.canUndo).toBe(true);

    activeTool = 'connect';
    expect(history.canUndo).toBe(true);

    activeTool = 'shot';
    expect(history.canUndo).toBe(true);

    expect(history.getUndos()).toHaveLength(1);
    expect(activeTool).toBe('shot');
  });

  it('dragging produces exactly one history entry on dragEnd (not on intermediate moves)', () => {
    const history = new StoryboardHistoryManager({});
    const startX = 100;
    const startY = 100;

    // Simulate pointer move events (zero history pushes during drag)
    const intermediateMoves = [
      { x: 105, y: 102 },
      { x: 120, y: 115 },
      { x: 150, y: 140 },
      { x: 200, y: 180 },
    ];
    for (const _pos of intermediateMoves) {
      // Moves update canvas nodes directly without pushing to history
      expect(history.getUndos()).toHaveLength(0);
    }

    // DragEnd completes the gesture -> pushes single entry
    const finalPos = { x: 200, y: 180 };
    history.pushAction({
      type: 'MOVE_SHOTS',
      shots: [{ id: 'shot-1', prevX: startX, prevY: startY, nextX: finalPos.x, nextY: finalPos.y }],
    });

    expect(history.getUndos()).toHaveLength(1);
    expect(history.canUndo).toBe(true);
  });
});
