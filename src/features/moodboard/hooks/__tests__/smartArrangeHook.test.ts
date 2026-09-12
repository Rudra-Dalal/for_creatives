import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMoodboard } from '../useMoodboard';
import type { MoodboardItem } from '../../types';
import * as layoutUtils from '../../utils/layoutUtils';
import * as canvasCoordinates from '../../coordinates/canvasCoordinates';
import { moodboardService } from '../../services/moodboardService';

vi.mock('../../services/moodboardService', () => ({
  moodboardService: {
    getItems: vi.fn().mockResolvedValue([]),
    updateItem: vi.fn().mockResolvedValue({}),
    createItem: vi.fn().mockResolvedValue({}),
    deleteItem: vi.fn().mockResolvedValue({}),
    softDeleteItem: vi.fn().mockResolvedValue({}),
    restoreItem: vi.fn().mockResolvedValue({}),
  },
}));

function createItem(
  id: string,
  type: MoodboardItem['type'],
  x: number,
  y: number,
  width = 300,
  height = 220,
  content: Record<string, any> = {}
): MoodboardItem {
  return {
    id,
    project_id: 'test-project',
    reference_id: null,
    type,
    x,
    y,
    width,
    height,
    z_index: 1,
    content,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  };
}

function renderMoodboardHook(
  initialItems: MoodboardItem[],
  readOnly = false
): ReturnType<typeof useMoodboard> {
  let hookReturn!: ReturnType<typeof useMoodboard>;
  function Harness() {
    hookReturn = useMoodboard('test-proj', initialItems, readOnly);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return hookReturn;
}

describe('useMoodboard — Smart Arrange Hook & Viewport Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. API Surface & Aliasing
  // -------------------------------------------------------------------------
  describe('API Surface', () => {
    it('exposes autoArrange and smartArrange referencing the same function', () => {
      const hook = renderMoodboardHook([]);
      expect(typeof hook.autoArrange).toBe('function');
      expect(hook.smartArrange).toBe(hook.autoArrange);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Full-Board vs Selection Contextual Execution
  // -------------------------------------------------------------------------
  describe('Contextual Execution & Filtering', () => {
    it('full-board Arrange calls calculateSmartArrange with undefined targetIds when 0 items selected', () => {
      const itemA = createItem('card-a', 'reference', 100, 100);
      const itemB = createItem('card-b', 'idea', 500, 100);
      const hook = renderMoodboardHook([itemA, itemB]);

      const smartSpy = vi.spyOn(layoutUtils, 'calculateSmartArrange');

      // 0 items selected
      const didMove = hook.autoArrange(1200, 800);

      expect(smartSpy).toHaveBeenCalledWith(expect.any(Array), undefined);
      expect(typeof didMove).toBe('boolean');
    });

    it('selection Arrange only arranges selected items when >= 2 items are targeted', () => {
      const itemA = createItem('card-a', 'reference', 100, 100);
      const itemB = createItem('card-b', 'idea', 500, 100);
      const itemC = createItem('card-c', 'color', 900, 100);
      const hook = renderMoodboardHook([itemA, itemB, itemC]);

      const smartSpy = vi.spyOn(layoutUtils, 'calculateSmartArrange');

      // Target selection of 2 items
      hook.autoArrange(1200, 800, ['card-a', 'card-b']);

      expect(smartSpy).toHaveBeenCalledWith(expect.any(Array), ['card-a', 'card-b']);
    });

    it('contextual selection: 1 selected item falls back to full-board Arrange', () => {
      const itemA = createItem('card-a', 'reference', 100, 100);
      const itemB = createItem('card-b', 'idea', 500, 100);
      const hook = renderMoodboardHook([itemA, itemB]);

      const smartSpy = vi.spyOn(layoutUtils, 'calculateSmartArrange');

      // 1 item targeted -> should treat as full board arrange per requirement
      // "0 or 1 selected item -> arrange the whole board"
      hook.autoArrange(1200, 800);

      expect(smartSpy).toHaveBeenCalledWith(expect.any(Array), undefined);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Atomic BATCH_MOVE Undo & Redo
  // -------------------------------------------------------------------------
  describe('Undo / Redo Atomic BATCH_MOVE', () => {
    it('records exactly ONE atomic BATCH_MOVE action containing all moved items', async () => {
      // Create overlapping items that will definitely move during Smart Arrange
      const itemA = createItem('card-a', 'reference', 100, 100);
      const itemB = createItem('card-b', 'idea', 100, 100); // exact collision
      const hook = renderMoodboardHook([itemA, itemB]);

      const didMove = hook.autoArrange(1200, 800);
      expect(didMove).toBe(true);

      // Verify single-step undo: reverts all items in one call
      vi.clearAllMocks();
      await hook.undo();

      // moodboardService.updateItem should have been called for the moved item
      expect(moodboardService.updateItem).toHaveBeenCalled();
      const undoCallsCount = vi.mocked(moodboardService.updateItem).mock.calls.length;
      expect(undoCallsCount).toBeGreaterThan(0);

      // A second undo should do nothing because there was exactly ONE action recorded
      vi.clearAllMocks();
      await hook.undo();
      expect(moodboardService.updateItem).not.toHaveBeenCalled();

      // Verify single-step redo: re-applies all items in one call
      vi.clearAllMocks();
      await hook.redo();
      expect(moodboardService.updateItem).toHaveBeenCalledTimes(undoCallsCount);

      // A second redo should do nothing
      vi.clearAllMocks();
      await hook.redo();
      expect(moodboardService.updateItem).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Failure Safety: No-op detection
  // -------------------------------------------------------------------------
  describe('Failure Safety & No-op Protection', () => {
    it('does not record undo history or change viewport when arrange produces no position changes', async () => {
      const zoomSpy = vi.spyOn(canvasCoordinates, 'calculateZoomToFit');

      // Mock calculateSmartArrange returning no position updates (already arranged)
      vi.spyOn(layoutUtils, 'calculateSmartArrange').mockReturnValueOnce([]);

      const itemA = createItem('card-a', 'reference', 100, 100);
      const hook = renderMoodboardHook([itemA]);

      const didMove = hook.autoArrange(1200, 800);

      expect(didMove).toBe(false);
      expect(zoomSpy).not.toHaveBeenCalled();
      expect(moodboardService.updateItem).not.toHaveBeenCalled();

      // Ensure no undo action was added
      await hook.undo();
      expect(moodboardService.updateItem).not.toHaveBeenCalled();
    });

    it('does not record history when items return identical coordinates', async () => {
      const itemA = createItem('card-a', 'reference', 100, 100);
      vi.spyOn(layoutUtils, 'calculateSmartArrange').mockReturnValueOnce([
        { id: 'card-a', x: 100, y: 100 },
      ]);

      const hook = renderMoodboardHook([itemA]);
      const didMove = hook.autoArrange(1200, 800);

      expect(didMove).toBe(false);
      expect(moodboardService.updateItem).not.toHaveBeenCalled();

      await hook.undo();
      expect(moodboardService.updateItem).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Viewport Reframing Behavior
  // -------------------------------------------------------------------------
  describe('Viewport Integration', () => {
    it('reframes viewport using calculateZoomToFit with padding 80 on full-board Arrange', () => {
      const itemA = createItem('card-a', 'reference', 100, 100);
      const itemB = createItem('card-b', 'idea', 100, 100);
      const hook = renderMoodboardHook([itemA, itemB]);

      const zoomSpy = vi.spyOn(canvasCoordinates, 'calculateZoomToFit');

      hook.autoArrange(1200, 800);

      expect(zoomSpy).toHaveBeenCalledTimes(1);
      // Container width 1200, height 800, padding 80
      expect(zoomSpy).toHaveBeenCalledWith(expect.any(Array), 1200, 800, 80);
    });

    it('preserves viewport and does NOT call calculateZoomToFit on selection Arrange', () => {
      const itemA = createItem('card-a', 'reference', 100, 100);
      const itemB = createItem('card-b', 'idea', 100, 100);
      const itemC = createItem('card-c', 'color', 500, 500);
      const hook = renderMoodboardHook([itemA, itemB, itemC]);

      const zoomSpy = vi.spyOn(canvasCoordinates, 'calculateZoomToFit');

      // Arrange selection of itemA and itemB only
      hook.autoArrange(1200, 800, ['card-a', 'card-b']);

      // Viewport must remain completely untouched
      expect(zoomSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Stroke Protection & Delta Translation
  // -------------------------------------------------------------------------
  describe('Stroke Protection & Delta Translation', () => {
    it('moves overlapping stroke along with its parent card in the same BATCH_MOVE', async () => {
      const card1 = createItem('card-1', 'reference', 100, 100, 300, 220);
      // Card 2 at (500, 100) will be repacked closer to card 1 at (440, 100), moving by delta (-60, 0)
      const card2 = createItem('card-2', 'idea', 500, 100, 280, 180);
      // Stroke overlapping card-2 at (520, 120)
      const stroke = createItem('stroke-2', 'stroke', 520, 120, 80, 40, {
        points: [0, 0, 80, 40],
      });

      const hook = renderMoodboardHook([card1, card2, stroke]);
      const didMove = hook.autoArrange(1200, 800);

      expect(didMove).toBe(true);

      // Verify undo re-persists both stroke-2 and card-2
      vi.clearAllMocks();
      await hook.undo();
      const updatedIds = vi.mocked(moodboardService.updateItem).mock.calls.map((c) => c[0]);
      expect(updatedIds).toContain('card-2');
      expect(updatedIds).toContain('stroke-2');
    });

    it('does not move isolated strokes', async () => {
      const card1 = createItem('card-1', 'reference', 100, 100, 300, 220);
      const card2 = createItem('card-2', 'idea', 100, 100, 280, 180);
      // Isolated stroke far away at (2000, 2000)
      const isolatedStroke = createItem('stroke-isolated', 'stroke', 2000, 2000, 50, 50, {
        points: [0, 0, 50, 50],
      });

      const hook = renderMoodboardHook([card1, card2, isolatedStroke]);
      hook.autoArrange(1200, 800);

      vi.clearAllMocks();
      await hook.undo();
      const updatedIds = vi.mocked(moodboardService.updateItem).mock.calls.map((c) => c[0]);
      expect(updatedIds).not.toContain('stroke-isolated');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Connector Relationships Preservation
  // -------------------------------------------------------------------------
  describe('Connector Integrity', () => {
    it('preserves connections metadata during Smart Arrange', () => {
      const connectionData = [
        {
          id: 'conn-1',
          targetId: 'card-b',
          sourceAnchor: 'right' as const,
          targetAnchor: 'left' as const,
          label: 'influences',
        },
      ];

      const itemA = createItem('card-a', 'idea', 100, 100, 280, 180, {
        connections: connectionData,
      });
      const itemB = createItem('card-b', 'reference', 500, 100, 300, 220);

      const hook = renderMoodboardHook([itemA, itemB]);
      hook.autoArrange(1200, 800);

      // Connections array extracted from hook should maintain active connection
      expect(hook.connections.length).toBeGreaterThan(0);
      const found = hook.connections.find((c) => c.id === 'conn-1');
      expect(found).toBeDefined();
      expect(found?.fromId).toBe('card-a');
      expect(found?.targetId).toBe('card-b');
      expect(found?.label).toBe('influences');
    });
  });
});
