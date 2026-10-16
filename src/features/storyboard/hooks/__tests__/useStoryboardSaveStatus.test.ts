/**
 * useStoryboardSaveStatus.test.ts
 *
 * Unit tests verifying save-status feedback tracking in useStoryboard:
 * - 'idle' initially
 * - 'saving' while mutations are in flight
 * - 'saved' on successful completion
 * - 'idle' after 2500ms auto-reset timeout
 * - 'error' with message when a mutation rejects
 * - clearSaveError() resets error state
 * - concurrent mutations keep status 'saving' until all finish
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStoryboard, type UseStoryboardReturn } from '../useStoryboard';
import { storyboardService } from '../../services/storyboardService';

vi.mock('../../services/storyboardService', () => ({
  storyboardService: {
    getScenesWithShots: vi.fn(),
    getConnections: vi.fn(),
    getStrokes: vi.fn(),
    createScene: vi.fn(),
    updateScene: vi.fn(),
    deleteScene: vi.fn(),
    reorderScenes: vi.fn(),
    createShot: vi.fn(),
    updateShot: vi.fn(),
    deleteShot: vi.fn(),
    duplicateShot: vi.fn(),
    batchUpdateShotPositions: vi.fn(),
    reorderShots: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    restoreConnection: vi.fn(),
    restoreShot: vi.fn(),
    restoreScene: vi.fn(),
    restoreStroke: vi.fn(),
    createStroke: vi.fn(),
    softDeleteStroke: vi.fn(),
  },
}));

const svc = vi.mocked(storyboardService);

function renderHook(projectId = 'proj-1'): UseStoryboardReturn {
  let hookValue!: UseStoryboardReturn;
  function TestHarness() {
    hookValue = useStoryboard(projectId);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(TestHarness));
  return hookValue;
}

describe('useStoryboard — save status feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    svc.getScenesWithShots.mockResolvedValue([]);
    svc.getConnections.mockResolvedValue([]);
    svc.getStrokes.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with idle saveStatus and null saveError', () => {
    const hook = renderHook();
    expect(hook.saveStatus).toBe('idle');
    expect(hook.saveError).toBeNull();
  });

  it('transitions to saved on successful mutation and resets to idle after 2.5s', async () => {
    svc.updateShot.mockResolvedValueOnce({} as any);
    const hook = renderHook();

    const savePromise = hook.updateShot('shot-1', { title: 'Updated Title' });
    // In flight
    expect(hook.saveStatus).toBe('saving');

    await savePromise;
    expect(hook.saveStatus).toBe('saved');
    expect(hook.saveError).toBeNull();

    // Fast forward 2.5s
    vi.advanceTimersByTime(2500);
    expect(hook.saveStatus).toBe('idle');
  });

  it('keeps status saving when multiple concurrent mutations are in flight', async () => {
    let resolveFirst!: (val?: any) => void;
    let resolveSecond!: (val?: any) => void;

    svc.updateShot
      .mockImplementationOnce(() => new Promise<any>((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => new Promise<any>((r) => { resolveSecond = r; }));

    const hook = renderHook();

    const p1 = hook.updateShot('shot-1', { title: 'Title A' });
    const p2 = hook.updateShot('shot-2', { title: 'Title B' });

    expect(hook.saveStatus).toBe('saving');

    // First finishes, second still in flight
    resolveFirst();
    await p1;
    expect(hook.saveStatus).toBe('saving');

    // Second finishes
    resolveSecond();
    await p2;
    expect(hook.saveStatus).toBe('saved');
  });

  it('transitions to error with error message when a mutation rejects', async () => {
    svc.updateScene.mockRejectedValueOnce(new Error('Network error writing scene'));
    const hook = renderHook();

    await expect(hook.updateScene('scene-1', { title: 'New Scene Title' })).rejects.toThrow(
      'Network error writing scene'
    );

    expect(hook.saveStatus).toBe('error');
    expect(hook.saveError).toBe('Network error writing scene');
  });

  it('clearSaveError resets status to idle and clears saveError', async () => {
    svc.deleteShot.mockRejectedValueOnce(new Error('Permission denied'));
    const hook = renderHook();

    await expect(hook.deleteShot('shot-1')).rejects.toThrow('Permission denied');
    expect(hook.saveStatus).toBe('error');
    expect(hook.saveError).toBe('Permission denied');

    hook.clearSaveError();
    expect(hook.saveStatus).toBe('idle');
    expect(hook.saveError).toBeNull();
  });

  it('clears previous error on subsequent successful save', async () => {
    svc.createShot.mockRejectedValueOnce(new Error('Initial failure'));
    const hook = renderHook();

    await hook.createShot('scene-1', { title: 'Failed shot' });
    expect(hook.saveStatus).toBe('error');
    expect(hook.saveError).toBe('Initial failure');

    // Subsequent save succeeds
    svc.updateShot.mockResolvedValueOnce({} as any);
    await hook.updateShot('shot-1', { title: 'Recovered shot' });

    expect(hook.saveStatus).toBe('saved');
    expect(hook.saveError).toBeNull();
  });
});
