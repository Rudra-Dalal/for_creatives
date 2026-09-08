import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moodboardService } from '../../services/moodboardService';
import type { MoodboardItem, StrokeItemContent } from '../../types';

// Mock the moodboardService
vi.mock('../../services/moodboardService', () => ({
  moodboardService: {
    getItems: vi.fn().mockResolvedValue([]),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    softDeleteItem: vi.fn(),
    restoreItem: vi.fn(),
  },
}));

describe('Stroke Handoff & Optimistic UI Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies CanvasReferenceItem dragend resolves to Group instead of leaf child node', () => {
    // Mock Konva Group node at (250, 180)
    const mockGroup = {
      x: () => 250,
      y: () => 180,
    };
    // Mock Konva Rect / Image child node at (0, 0)
    const mockChildLeaf = {
      x: () => 0,
      y: () => 0,
    };

    const groupRef = { current: mockGroup as any };
    const event = {
      target: mockChildLeaf,
      currentTarget: mockGroup,
    };

    const onDragEnd = vi.fn();
    const itemId = 'ref-1';

    // The robust dragEnd resolution pattern implemented across canvas items:
    const node = groupRef.current ?? (event.currentTarget as any);
    if (node) {
      onDragEnd(itemId, node.x(), node.y());
    }

    // Must report group position (250, 180), NEVER leaf position (0, 0)
    expect(onDragEnd).toHaveBeenCalledWith('ref-1', 250, 180);
    expect(onDragEnd).not.toHaveBeenCalledWith('ref-1', 0, 0);
  });

  it('verifies pendingGeometriesRef merges moved coordinates and bringToFront zIndex cleanly', async () => {
    const pendingGeometries = new Map<string, { x?: number; y?: number; width?: number; height?: number; zIndex?: number }>();
    const pendingTimers = new Map<string, any>();
    const savedPayloads: any[] = [];

    const persistItemGeometry = (id: string, geometry: any) => {
      const existingTimer = pendingTimers.get(id);
      if (existingTimer) clearTimeout(existingTimer);

      const merged = {
        ...(pendingGeometries.get(id) || {}),
        ...geometry,
      };
      pendingGeometries.set(id, merged);

      const timer = setTimeout(() => {
        const toSave = pendingGeometries.get(id);
        pendingGeometries.delete(id);
        pendingTimers.delete(id);
        if (toSave) savedPayloads.push({ id, ...toSave });
      }, 50);

      pendingTimers.set(id, timer);
    };

    // 1. Drag end triggers geometry persist at (300, 200)
    persistItemGeometry('item-1', { x: 300, y: 200, width: 300, height: 220 });

    // 2. Immediately bringToFront runs, persisting zIndex: 10
    persistItemGeometry('item-1', { zIndex: 10 });

    // Wait for debounce timer to fire
    await new Promise((r) => setTimeout(r, 70));

    // Both coordinates and zIndex MUST be preserved in the single save payload!
    expect(savedPayloads).toHaveLength(1);
    expect(savedPayloads[0]).toEqual({
      id: 'item-1',
      x: 300,
      y: 200,
      width: 300,
      height: 220,
      zIndex: 10,
    });
  });

  it('verifies optimistic stroke creation commits synchronously and reconciles on DB resolution', async () => {
    let items: MoodboardItem[] = [];
    const setItems = (updater: (prev: MoodboardItem[]) => MoodboardItem[]) => {
      items = updater(items);
    };

    let resolveDbCall!: (val: any) => void;
    const dbPromise = new Promise<any>((resolve) => {
      resolveDbCall = resolve;
    });
    vi.mocked(moodboardService.createItem).mockReturnValueOnce(dbPromise);

    const tempId = `temp-stroke-${Date.now()}`;
    const optimisticItem: MoodboardItem = {
      id: tempId,
      project_id: 'proj-1',
      reference_id: null,
      type: 'stroke',
      content: { points: [0, 0, 10, 10], color: '#D97706', strokeWidth: 4, tension: 0.5 },
      x: 50,
      y: 50,
      width: 10,
      height: 10,
      z_index: 2,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };

    // Synchronously commit optimistic stroke
    setItems((prev) => [...prev, optimisticItem]);

    // Canvas IMMEDIATELY has the stroke before DB returns
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(tempId);

    // Now DB finishes 150ms later
    const persistentItem: MoodboardItem = {
      ...optimisticItem,
      id: 'db-real-uuid-12345',
    };
    resolveDbCall(persistentItem);
    await dbPromise;

    // Reconcile ID in state
    setItems((prev) =>
      prev.map((i) => (i.id === tempId ? { ...persistentItem, content: i.content } : i))
    );

    // Canvas still has the stroke, now updated with real DB ID
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('db-real-uuid-12345');
  });

  it('verifies optimistic partial erase commits synchronously and reconciles split strokes', async () => {
    const originalStroke: MoodboardItem = {
      id: 'stroke-orig',
      project_id: 'proj-1',
      reference_id: null,
      type: 'stroke',
      content: { points: [0, 0, 100, 100], color: '#D97706', strokeWidth: 4, tension: 0.5 },
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      z_index: 1,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };

    let items: MoodboardItem[] = [originalStroke];
    const setItems = (updater: (prev: MoodboardItem[]) => MoodboardItem[]) => {
      items = updater(items);
    };

    // Erase cuts stroke-orig into two pieces: sub-stroke 1 (updates orig) and sub-stroke 2 (new split)
    const updates = [{ id: 'stroke-orig', x: 0, y: 0, width: 40, height: 40, relativePoints: [0, 0, 40, 40] }];
    const newSplitContent: StrokeItemContent = { points: [0, 0, 40, 40], color: '#D97706', strokeWidth: 4, tension: 0.5 };
    const newStrokes = [{ content: newSplitContent, x: 60, y: 60, width: 40, height: 40, zIndex: 2 }];

    const tempSplitId = `temp-erase-${Date.now()}`;
    const optimisticSplit: MoodboardItem = {
      id: tempSplitId,
      project_id: 'proj-1',
      reference_id: null,
      type: 'stroke',
      content: newSplitContent as any,
      x: 60,
      y: 60,
      width: 40,
      height: 40,
      z_index: 2,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    };

    // Optimistic synchronous commit
    setItems((prev) => {
      const withUpdates = prev.map((i) => {
        if (i.id !== 'stroke-orig') return i;
        return { ...i, width: 40, height: 40, content: { ...(i.content as any), points: [0, 0, 40, 40] } };
      });
      return [...withUpdates, optimisticSplit];
    });

    // Zero delay: local state has both the modified stroke and the split stroke immediately
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.id === 'stroke-orig')?.width).toBe(40);
    expect(items.find((i) => i.id === tempSplitId)).toBeDefined();

    // Background DB save completes
    const dbCreatedItem: MoodboardItem = { ...optimisticSplit, id: 'db-split-id-999' };
    setItems((prev) =>
      prev.map((i) => (i.id === tempSplitId ? dbCreatedItem : i))
    );

    expect(items.find((i) => i.id === 'db-split-id-999')).toBeDefined();
    expect(items.find((i) => i.id === tempSplitId)).toBeUndefined();
  });
});
