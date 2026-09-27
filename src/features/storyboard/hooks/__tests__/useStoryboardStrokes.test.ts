import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStoryboard } from '../useStoryboard';
import type { StoryboardStroke } from '../../types';
import { storyboardService } from '../../services/storyboardService';

// ---------------------------------------------------------------------------
// Mock storyboardService
// ---------------------------------------------------------------------------

vi.mock('../../services/storyboardService', () => ({
  storyboardService: {
    getScenesWithShots: vi.fn(),
    getConnections: vi.fn(),
    getStrokes: vi.fn(),
    createStroke: vi.fn(),
    softDeleteStroke: vi.fn(),
  },
}));

const svc = vi.mocked(storyboardService);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeStroke(partial: Partial<StoryboardStroke> & { id: string }): StoryboardStroke {
  return {
    project_id: 'proj-1',
    points: [100.5, 200.5, 300.5, 400.5],
    stroke_color: '#D97706',
    stroke_width: 4,
    created_at: '2026-09-27T10:00:00.000Z',
    updated_at: '2026-09-27T10:00:00.000Z',
    deleted_at: null,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Hook harness
// ---------------------------------------------------------------------------

function renderHook(projectId = 'proj-1'): ReturnType<typeof useStoryboard> {
  let result!: ReturnType<typeof useStoryboard>;
  function Harness() {
    result = useStoryboard(projectId);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useStoryboard — Stroke State & Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getScenesWithShots.mockResolvedValue([]);
    svc.getConnections.mockResolvedValue([]);
    svc.getStrokes.mockResolvedValue([]);
    svc.createStroke.mockImplementation(async (input) =>
      makeStroke({
        id: 'real-db-stroke-1',
        project_id: input.projectId,
        points: input.points,
        stroke_color: input.strokeColor,
        stroke_width: input.strokeWidth,
      })
    );
    svc.softDeleteStroke.mockImplementation(async (id) =>
      makeStroke({ id, deleted_at: '2026-09-27T11:00:00.000Z' })
    );
  });

  // =========================================================================
  // 1. Initial State
  // =========================================================================
  describe('initial state', () => {
    it('exposes an empty strokes array synchronously (never undefined)', () => {
      const hook = renderHook();
      expect(hook.strokes).toEqual([]);
      expect(Array.isArray(hook.strokes)).toBe(true);
    });

    it('exposes addStroke and eraseStroke functions', () => {
      const hook = renderHook();
      expect(typeof hook.addStroke).toBe('function');
      expect(typeof hook.eraseStroke).toBe('function');
    });
  });

  // =========================================================================
  // 2. Initial Loading (getStrokes in fetchStoryboard)
  // =========================================================================
  describe('loading', () => {
    it('includes getStrokes in the initial storyboard load and populates strokes state', async () => {
      const initialStrokes = [
        makeStroke({ id: 'stroke-1', points: [0, 0, 10, 10] }),
        makeStroke({ id: 'stroke-2', points: [20, 20, 30, 30] }),
      ];
      svc.getStrokes.mockResolvedValueOnce(initialStrokes);

      const hook = renderHook('proj-1');
      await hook.refresh();

      expect(svc.getStrokes).toHaveBeenCalledWith('proj-1');
      expect(hook.strokes).toEqual(initialStrokes);
    });

    it('surfaces error when getStrokes fails during refresh', async () => {
      svc.getStrokes.mockRejectedValueOnce(new Error('getStrokes: Database failure'));

      const hook = renderHook('proj-1');
      await hook.refresh();

      expect(hook.error).toBe('getStrokes: Database failure');
    });
  });

  // =========================================================================
  // 3. addStroke Success
  // =========================================================================
  describe('addStroke success', () => {
    it('appends an optimistic temporary stroke while create is pending', async () => {
      let resolveCreate!: (val: StoryboardStroke) => void;
      svc.createStroke.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );

      const hook = renderHook('proj-1');
      const addPromise = hook.addStroke([10, 20, 30, 40], '#10B981', 3);

      // Check state while creation is in-flight
      expect(hook.strokes).toHaveLength(1);
      const tempStroke = hook.strokes[0];
      expect(tempStroke.id).toMatch(/^temp-stroke-/);
      expect(tempStroke.project_id).toBe('proj-1');
      expect(tempStroke.points).toEqual([10, 20, 30, 40]);
      expect(tempStroke.stroke_color).toBe('#10B981');
      expect(tempStroke.stroke_width).toBe(3);
      expect(tempStroke.deleted_at).toBeNull();

      // Resolve creation
      const realStroke = makeStroke({
        id: 'real-uuid-999',
        points: [10, 20, 30, 40],
        stroke_color: '#10B981',
        stroke_width: 3,
      });
      resolveCreate(realStroke);
      const result = await addPromise;

      // Verify replaced without duplicates
      expect(result).toEqual(realStroke);
      expect(hook.strokes).toHaveLength(1);
      expect(hook.strokes[0]).toEqual(realStroke);
      expect(hook.strokes[0].id).toBe('real-uuid-999');
    });

    it('passes exact projectId, points, color, and width to service', async () => {
      const hook = renderHook('proj-special');
      const testPoints = [15.2, 33.4, 88.9, 120.1];

      await hook.addStroke(testPoints, '#D97706', 5);

      expect(svc.createStroke).toHaveBeenCalledWith({
        projectId: 'proj-special',
        points: testPoints,
        strokeColor: '#D97706',
        strokeWidth: 5,
      });
    });
  });

  // =========================================================================
  // 4. addStroke Failure (Rollback)
  // =========================================================================
  describe('addStroke failure', () => {
    it('removes only the temporary stroke on error and surfaces the error message', async () => {
      // Seed existing stroke via initial load
      const existing = makeStroke({ id: 'existing-stroke', points: [0, 0, 5, 5] });
      svc.getStrokes.mockResolvedValueOnce([existing]);

      const hook = renderHook('proj-1');
      await hook.refresh();
      expect(hook.strokes).toEqual([existing]);

      // Service failure
      svc.createStroke.mockRejectedValueOnce(new Error('createStroke: DB write failed'));

      const result = await hook.addStroke([10, 20, 30, 40], '#EF4444', 2);

      // Verify return and rollback
      expect(result).toBeNull();
      expect(hook.strokes).toEqual([existing]);
      expect(hook.error).toBe('createStroke: DB write failed');
    });
  });

  // =========================================================================
  // 5. eraseStroke Success
  // =========================================================================
  describe('eraseStroke success', () => {
    it('removes the stroke immediately and calls softDeleteStroke with correct id', async () => {
      const stroke1 = makeStroke({ id: 'stroke-1' });
      const stroke2 = makeStroke({ id: 'stroke-2' });
      svc.getStrokes.mockResolvedValueOnce([stroke1, stroke2]);

      const hook = renderHook('proj-1');
      await hook.refresh();
      expect(hook.strokes).toHaveLength(2);

      const success = await hook.eraseStroke('stroke-1');

      expect(success).toBe(true);
      expect(svc.softDeleteStroke).toHaveBeenCalledWith('stroke-1');
      expect(hook.strokes).toEqual([stroke2]);
    });
  });

  // =========================================================================
  // 6. eraseStroke Failure (Rollback to exact position)
  // =========================================================================
  describe('eraseStroke failure', () => {
    it('restores the exact stroke to its original array position on failure and sets error', async () => {
      const s0 = makeStroke({ id: 'stroke-0' });
      const s1 = makeStroke({ id: 'stroke-1' });
      const s2 = makeStroke({ id: 'stroke-2' });
      svc.getStrokes.mockResolvedValueOnce([s0, s1, s2]);

      const hook = renderHook('proj-1');
      await hook.refresh();
      expect(hook.strokes).toEqual([s0, s1, s2]);

      svc.softDeleteStroke.mockRejectedValueOnce(new Error('softDeleteStroke: network offline'));

      const success = await hook.eraseStroke('stroke-1');

      expect(success).toBe(false);
      expect(hook.error).toBe('softDeleteStroke: network offline');
      // Verify exact position (index 1) preserved
      expect(hook.strokes).toEqual([s0, s1, s2]);
      expect(hook.strokes[1].id).toBe('stroke-1');
    });
  });

  // =========================================================================
  // 7. Multiple Strokes Independence
  // =========================================================================
  describe('multiple strokes', () => {
    it('adding a stroke does not overwrite or reorder existing strokes', async () => {
      const s1 = makeStroke({ id: 's-1' });
      svc.getStrokes.mockResolvedValueOnce([s1]);

      const hook = renderHook('proj-1');
      await hook.refresh();

      svc.createStroke.mockResolvedValueOnce(makeStroke({ id: 's-2' }));
      await hook.addStroke([10, 10, 20, 20], '#3B82F6', 4);

      expect(hook.strokes.map((s) => s.id)).toEqual(['s-1', 's-2']);
    });

    it('erasing one stroke does not affect other strokes', async () => {
      const s1 = makeStroke({ id: 's-1' });
      const s2 = makeStroke({ id: 's-2' });
      const s3 = makeStroke({ id: 's-3' });
      svc.getStrokes.mockResolvedValueOnce([s1, s2, s3]);

      const hook = renderHook('proj-1');
      await hook.refresh();

      await hook.eraseStroke('s-2');

      expect(hook.strokes.map((s) => s.id)).toEqual(['s-1', 's-3']);
    });
  });

  // =========================================================================
  // 8. World-Coordinate Passthrough
  // =========================================================================
  describe('world-coordinate passthrough', () => {
    it('passes coordinate numbers directly without transformation or projection', async () => {
      const hook = renderHook('proj-1');
      const worldPoints = [-1250.7, 850.3, 0.0, -42.9, 10000.5, 99999.1];

      await hook.addStroke(worldPoints, '#F59E0B', 8);

      expect(svc.createStroke).toHaveBeenCalledWith(
        expect.objectContaining({
          points: worldPoints,
        })
      );
    });
  });

  // =========================================================================
  // 9. No-op Safety
  // =========================================================================
  describe('no-op safety', () => {
    it('returns false and does not call service when attempting to erase a nonexistent ID', async () => {
      const s1 = makeStroke({ id: 's-1' });
      svc.getStrokes.mockResolvedValueOnce([s1]);

      const hook = renderHook('proj-1');
      await hook.refresh();

      const result = await hook.eraseStroke('nonexistent-id');

      expect(result).toBe(false);
      expect(svc.softDeleteStroke).not.toHaveBeenCalled();
      expect(hook.strokes).toEqual([s1]);
    });
  });
});
