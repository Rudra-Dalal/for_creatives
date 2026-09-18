/**
 * useStoryboard — Connection State Tests
 *
 * Tests the connection-related state management inside useStoryboard using a
 * mocked storyboardService (no Supabase round-trips).
 *
 * Follows the same ReactDOMServer.renderToString hook harness pattern used
 * across the existing moodboard hook test suite.
 *
 * NOTE: vi.mock factory must not reference top-level variables (they are
 * uninitialized when the factory runs due to hoisting). Service mocks are
 * accessed via vi.mocked() after the mock is registered.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStoryboard } from '../useStoryboard';
import type { StoryboardShotConnection } from '../../types';
import { storyboardService } from '../../services/storyboardService';

// ---------------------------------------------------------------------------
// Mock storyboardService — factory uses no top-level variable references
// ---------------------------------------------------------------------------

vi.mock('../../services/storyboardService', () => ({
  storyboardService: {
    getScenesWithShots: vi.fn(),
    getConnections: vi.fn(),
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
  },
}));

// Typed references — safe after mock registration
const svc = vi.mocked(storyboardService);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeConnection(partial: Partial<StoryboardShotConnection> & { id: string }): StoryboardShotConnection {
  return {
    project_id: 'proj-1',
    from_shot_id: 'shot-A',
    to_shot_id: 'shot-B',
    from_anchor: 'right',
    to_anchor: 'left',
    transition_label: '',
    created_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...partial,
  } as StoryboardShotConnection;
}

// ---------------------------------------------------------------------------
// Hook harness
// ---------------------------------------------------------------------------

function renderHook(): ReturnType<typeof useStoryboard> {
  let result!: ReturnType<typeof useStoryboard>;
  function Harness() {
    result = useStoryboard('proj-1');
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useStoryboard — connection state management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getScenesWithShots.mockResolvedValue([]);
    svc.getConnections.mockResolvedValue([]);
    svc.createConnection.mockResolvedValue(makeConnection({ id: 'conn-1' }));
    svc.updateConnection.mockResolvedValue(makeConnection({ id: 'conn-1', transition_label: 'Cut' }));
    svc.deleteConnection.mockResolvedValue(undefined);
    svc.restoreConnection.mockResolvedValue(makeConnection({ id: 'conn-1' }));
  });

  // =========================================================================
  // 1. Initial state
  // =========================================================================
  describe('initial state', () => {
    it('exposes an empty connections array synchronously (before effects fire)', () => {
      // useEffect does not run in ReactDOMServer.renderToString; the initial
      // state must be an empty array — this is the synchronous contract.
      const hook = renderHook();
      expect(hook.connections).toEqual([]);
    });

    it('exposes a getConnections-shaped array (always an array, never undefined)', () => {
      const hook = renderHook();
      expect(Array.isArray(hook.connections)).toBe(true);
    });
  });

  // =========================================================================
  // 2. createConnection handler
  // =========================================================================
  describe('createConnection', () => {
    it('calls storyboardService.createConnection with projectId + input', async () => {
      const hook = renderHook();
      await hook.createConnection({ fromShotId: 'shot-A', toShotId: 'shot-B' });
      expect(svc.createConnection).toHaveBeenCalledWith({
        projectId: 'proj-1',
        fromShotId: 'shot-A',
        toShotId: 'shot-B',
      });
    });

    it('returns the created connection', async () => {
      const hook = renderHook();
      const result = await hook.createConnection({ fromShotId: 'shot-A', toShotId: 'shot-B' });
      expect(result).toMatchObject({ id: 'conn-1', from_shot_id: 'shot-A', to_shot_id: 'shot-B' });
    });

    it('returns null when the service throws', async () => {
      svc.createConnection.mockRejectedValueOnce(new Error('SelfConnection: cannot connect a shot to itself'));
      const hook = renderHook();
      const result = await hook.createConnection({ fromShotId: 'shot-A', toShotId: 'shot-A' });
      expect(result).toBeNull();
    });

    it('passes optional anchor and label fields through to the service', async () => {
      const hook = renderHook();
      await hook.createConnection({
        fromShotId: 'shot-A',
        toShotId: 'shot-B',
        fromAnchor: 'top',
        toAnchor: 'bottom',
        transitionLabel: 'Dissolve',
      });
      expect(svc.createConnection).toHaveBeenCalledWith({
        projectId: 'proj-1',
        fromShotId: 'shot-A',
        toShotId: 'shot-B',
        fromAnchor: 'top',
        toAnchor: 'bottom',
        transitionLabel: 'Dissolve',
      });
    });
  });

  // =========================================================================
  // 3. updateConnection handler
  // =========================================================================
  describe('updateConnection', () => {
    it('calls storyboardService.updateConnection with the correct args', async () => {
      const hook = renderHook();
      await hook.updateConnection('conn-1', { transitionLabel: 'Cut' });
      expect(svc.updateConnection).toHaveBeenCalledWith('conn-1', { transitionLabel: 'Cut' });
    });

    it('throws when the service throws', async () => {
      svc.updateConnection.mockRejectedValueOnce(new Error('updateConnection: no mutable fields provided'));
      const hook = renderHook();
      await expect(hook.updateConnection('conn-1', {})).rejects.toThrow('no mutable fields');
    });
  });

  // =========================================================================
  // 4. deleteConnection handler
  // =========================================================================
  describe('deleteConnection', () => {
    it('calls storyboardService.deleteConnection with the correct id', async () => {
      const hook = renderHook();
      await hook.deleteConnection('conn-1');
      expect(svc.deleteConnection).toHaveBeenCalledWith('conn-1');
    });

    it('throws when the service throws', async () => {
      svc.deleteConnection.mockRejectedValueOnce(new Error('DB error'));
      const hook = renderHook();
      await expect(hook.deleteConnection('conn-1')).rejects.toThrow('DB error');
    });
  });

  // =========================================================================
  // 5. restoreConnection handler
  // =========================================================================
  describe('restoreConnection', () => {
    it('calls storyboardService.restoreConnection with the correct id', async () => {
      const hook = renderHook();
      await hook.restoreConnection('conn-1');
      expect(svc.restoreConnection).toHaveBeenCalledWith('conn-1');
    });

    it('returns the restored connection', async () => {
      const hook = renderHook();
      const result = await hook.restoreConnection('conn-1');
      expect(result).toMatchObject({ id: 'conn-1' });
    });

    it('returns null when the service throws', async () => {
      svc.restoreConnection.mockRejectedValueOnce(new Error('Not found'));
      const hook = renderHook();
      const result = await hook.restoreConnection('conn-1');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // 6. Hook contract — connections is always an array (never undefined)
  // =========================================================================
  describe('connections contract', () => {
    it('connections is always an array', () => {
      const hook = renderHook();
      expect(Array.isArray(hook.connections)).toBe(true);
    });

    it('createConnection, updateConnection, deleteConnection, restoreConnection are functions', () => {
      const hook = renderHook();
      expect(typeof hook.createConnection).toBe('function');
      expect(typeof hook.updateConnection).toBe('function');
      expect(typeof hook.deleteConnection).toBe('function');
      expect(typeof hook.restoreConnection).toBe('function');
    });
  });
});
