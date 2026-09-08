import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { useSelection } from '../useSelection';
import { useMarquee } from '../useMarquee';
import { calculateTransformedBounds, useItemTransform } from '../useItemTransform';
import { useCanvasKeyboardShortcuts, isKeyboardTargetActive } from '../useCanvasKeyboardShortcuts';
import {
  CLICK_VS_DRAG_THRESHOLD_PX,
  CORNER_PRIORITY_ZONE_PX,
} from '../../coordinates';
import {
  TRANSFORMER_MIN_WIDTH,
  TRANSFORMER_MIN_HEIGHT,
  ASPECT_LOCKED_MIN_HEIGHT,
  ASPECT_LOCKED_MAX_HEIGHT,
} from '../../items/itemTypes';
import type { MoodboardItem } from '../../types';
import type { UseSelectionOptions } from '../selectionTypes';

// ---------------------------------------------------------------------------
// Hook Test Harnesses
// ---------------------------------------------------------------------------

function renderSelection(opts: UseSelectionOptions = {}) {
  let result!: ReturnType<typeof useSelection>;
  function Harness() {
    result = useSelection(opts);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

function renderMarquee(props: Parameters<typeof useMarquee>[0]) {
  let result!: ReturnType<typeof useMarquee>;
  function Harness() {
    result = useMarquee(props);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

function renderItemTransform(opts: Parameters<typeof useItemTransform>[0] = {}) {
  let result!: ReturnType<typeof useItemTransform>;
  function Harness() {
    result = useItemTransform(opts);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

// ---------------------------------------------------------------------------
// Shared Item Fixtures
// ---------------------------------------------------------------------------

const item1: MoodboardItem = {
  id: 'item-1',
  project_id: 'proj-1',
  reference_id: null,
  type: 'reference',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  z_index: 1,
  content: {},
  created_at: '',
  updated_at: '',
  deleted_at: null,
};

const item2: MoodboardItem = {
  id: 'item-2',
  project_id: 'proj-1',
  reference_id: null,
  type: 'text',
  x: 400,
  y: 300,
  width: 240,
  height: 160,
  z_index: 2,
  content: {},
  created_at: '',
  updated_at: '',
  deleted_at: null,
};

const item3: MoodboardItem = {
  id: 'item-3',
  project_id: 'proj-1',
  reference_id: null,
  type: 'color',
  x: 700,
  y: 500,
  width: 180,
  height: 180,
  z_index: 3,
  content: {},
  created_at: '',
  updated_at: '',
  deleted_at: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Selection & Transformer Engine — Stage 4', () => {

  // =========================================================================
  // 1. useSelection
  // =========================================================================
  describe('useSelection — Authoritative Selection State', () => {
    it('initializes with empty selection by default', () => {
      const sel = renderSelection();
      expect(sel.selectedIds).toEqual([]);
      expect(sel.hasSelection).toBe(false);
      expect(sel.selectedCount).toBe(0);
      expect(sel.isSingleSelection).toBe(false);
    });

    it('initializes with provided initialSelectedIds', () => {
      const sel = renderSelection({ initialSelectedIds: ['item-1'] });
      expect(sel.selectedIds).toEqual(['item-1']);
      expect(sel.hasSelection).toBe(true);
      expect(sel.selectedCount).toBe(1);
      expect(sel.isSingleSelection).toBe(true);
      expect(sel.isSelected('item-1')).toBe(true);
      expect(sel.isSelected('item-2')).toBe(false);
    });

    it('selects single item and clears previous selection', () => {
      const onSelectionChange = vi.fn();
      const sel = renderSelection({ initialSelectedIds: ['item-1', 'item-2'], onSelectionChange });

      sel.select('item-3');
      expect(onSelectionChange).toHaveBeenCalledWith(['item-3']);

      sel.select(null);
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('toggles selection with Shift key (adds unselected, removes selected)', () => {
      const onSelectionChange = vi.fn();
      const sel = renderSelection({ initialSelectedIds: ['item-1'], onSelectionChange });

      // Add item-2
      sel.toggleSelect('item-2');
      expect(onSelectionChange).toHaveBeenCalledWith(['item-1', 'item-2']);

      // Remove item-1
      sel.toggleSelect('item-1');
      expect(onSelectionChange).toHaveBeenCalledWith(['item-2']);
    });

    it('extends selection with extendSelection', () => {
      const onSelectionChange = vi.fn();
      const sel = renderSelection({ initialSelectedIds: ['item-1'], onSelectionChange });

      sel.extendSelection(['item-2', 'item-3']);
      expect(onSelectionChange).toHaveBeenCalledWith(['item-1', 'item-2', 'item-3']);
    });

    it('selects all items with selectAll', () => {
      const onSelectionChange = vi.fn();
      const sel = renderSelection({ onSelectionChange });

      sel.selectAll(['item-1', 'item-2', 'item-3']);
      expect(onSelectionChange).toHaveBeenCalledWith(['item-1', 'item-2', 'item-3']);
    });

    it('clears selection with clearSelection', () => {
      const onSelectionChange = vi.fn();
      const sel = renderSelection({ initialSelectedIds: ['item-1', 'item-2'], onSelectionChange });

      sel.clearSelection();
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('handlePointerDownItem preserves multi-selection when clicking already-selected item', () => {
      const onSelectionChange = vi.fn();
      const sel = renderSelection({ initialSelectedIds: ['item-1', 'item-2'], onSelectionChange });

      // Clicking item-1 which is already selected must NOT collapse to ['item-1'] on mousedown
      sel.handlePointerDownItem('item-1', false);
      expect(onSelectionChange).not.toHaveBeenCalled();

      // Clicking item-3 which is NOT selected collapses immediately to ['item-3']
      sel.handlePointerDownItem('item-3', false);
      expect(onSelectionChange).toHaveBeenCalledWith(['item-3']);
    });

    it('handleClickVsDragCollapse collapses multi-selection only if movement was within CLICK_VS_DRAG_THRESHOLD_PX', () => {
      const onSelectionChange = vi.fn();
      const sel = renderSelection({ initialSelectedIds: ['item-1', 'item-2'], onSelectionChange });

      // Stationary gesture (0px movement <= 4px threshold): collapse to clicked item
      sel.handleClickVsDragCollapse('item-1', 2);
      expect(onSelectionChange).toHaveBeenCalledWith(['item-1']);

      onSelectionChange.mockClear();

      // Real drag gesture (40px movement > 4px threshold): keep multi-selection intact!
      sel.handleClickVsDragCollapse('item-1', 40);
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it('blocks all selection modifications when readOnly is true', () => {
      const onSelectionChange = vi.fn();
      const sel = renderSelection({
        initialSelectedIds: ['item-1'],
        readOnly: true,
        onSelectionChange,
      });

      sel.select('item-2');
      sel.toggleSelect('item-2');
      sel.clearSelection();
      sel.selectAll(['item-1', 'item-2']);
      sel.handlePointerDownItem('item-2');
      sel.handleClickVsDragCollapse('item-1', 0);

      expect(onSelectionChange).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. useMarquee
  // =========================================================================
  describe('useMarquee — Marquee Geometry & AABB Intersection', () => {
    it('initiates on empty canvas mousedown and respects CLICK_VS_DRAG_THRESHOLD_PX', () => {
      const onSelectIds = vi.fn();
      const mockStage = {
        name: () => 'stage',
        getPointerPosition: () => ({ x: 100, y: 100 }),
      };
      const stageRef = { current: mockStage as any };

      const marquee = renderMarquee({
        items: [item1, item2],
        viewport: { x: 0, y: 0, scale: 1.0 },
        stageRef,
        onSelectIds,
        selectedIds: [],
        enabled: true,
      });

      // Mousedown on empty stage
      marquee.handleStageMouseDown({
        evt: { button: 0 },
        target: mockStage,
      } as any);

      // Micro-move (2px movement < CLICK_VS_DRAG_THRESHOLD_PX of 4px)
      mockStage.getPointerPosition = () => ({ x: 102, y: 101 });
      marquee.handleStageMouseMove({
        evt: { shiftKey: false },
        target: mockStage,
      } as any);

      // Must NOT show box or emit selection yet
      expect(marquee.selectionBox).toBeNull();
      expect(onSelectIds).not.toHaveBeenCalled();

      // Drag beyond threshold (from 100,100 to 350,280 -> w: 250, h: 180)
      mockStage.getPointerPosition = () => ({ x: 350, y: 280 });
      marquee.handleStageMouseMove({
        evt: { shiftKey: false },
        target: mockStage,
      } as any);

      // Marquee active and overlaps item1 (x: 100, y: 100, w: 200, h: 150)
      expect(onSelectIds).toHaveBeenCalledWith(['item-1']);

      // Drag end cleans up
      marquee.handleStageMouseUp();
      expect(marquee.selectionBox).toBeNull();
    });

    it('normalizes negative coordinate drag correctly (dragging up-left)', () => {
      const onSelectIds = vi.fn();
      const mockStage = {
        name: () => 'stage',
        getPointerPosition: () => ({ x: 500, y: 400 }),
      };
      const stageRef = { current: mockStage as any };

      const marquee = renderMarquee({
        items: [item1, item2],
        viewport: { x: 0, y: 0, scale: 1.0 },
        stageRef,
        onSelectIds,
        selectedIds: [],
        enabled: true,
      });

      // Start at (500, 400)
      marquee.handleStageMouseDown({
        evt: { button: 0 },
        target: mockStage,
      } as any);

      // Drag up-left to (350, 250) -> overlapping item-2 (x: 400, y: 300, w: 240, h: 160)
      mockStage.getPointerPosition = () => ({ x: 350, y: 250 });
      marquee.handleStageMouseMove({
        evt: { shiftKey: false },
        target: mockStage,
      } as any);

      // Overlaps item-2
      expect(onSelectIds).toHaveBeenCalledWith(['item-2']);
    });

    it('preserves existing selection when Shift is held during marquee', () => {
      const onSelectIds = vi.fn();
      const mockStage = {
        name: () => 'stage',
        getPointerPosition: () => ({ x: 50, y: 50 }),
      };
      const stageRef = { current: mockStage as any };

      const marquee = renderMarquee({
        items: [item1, item2],
        viewport: { x: 0, y: 0, scale: 1.0 },
        stageRef,
        onSelectIds,
        selectedIds: ['item-2'], // item-2 was already selected
        enabled: true,
      });

      // Shift + mousedown
      marquee.handleStageMouseDown({
        evt: { button: 0, shiftKey: true },
        target: mockStage,
      } as any);

      // Drag over item-1
      mockStage.getPointerPosition = () => ({ x: 320, y: 270 });
      marquee.handleStageMouseMove({
        evt: { shiftKey: true },
        target: mockStage,
      } as any);

      // Merges with existing item-2 selection
      expect(onSelectIds).toHaveBeenCalledWith(['item-2', 'item-1']);
    });
  });

  // =========================================================================
  // 3. useItemTransform & calculateTransformedBounds
  // =========================================================================
  describe('useItemTransform & calculateTransformedBounds — Resize Behavior', () => {
    it('enforces TRANSFORMER_MIN_WIDTH (40) and TRANSFORMER_MIN_HEIGHT (30)', () => {
      const oldBox = { x: 100, y: 100, width: 200, height: 150 };

      // Attempt resize below min width (35px < 40px)
      const tooNarrow = { x: 100, y: 100, width: 35, height: 150 };
      expect(calculateTransformedBounds(oldBox, tooNarrow, false)).toEqual(oldBox);

      // Attempt resize below min height (25px < 30px)
      const tooShort = { x: 100, y: 100, width: 200, height: 25 };
      expect(calculateTransformedBounds(oldBox, tooShort, false)).toEqual(oldBox);

      // Valid resize
      const valid = { x: 100, y: 100, width: 250, height: 180 };
      expect(calculateTransformedBounds(oldBox, valid, false)).toEqual(valid);
    });

    it('enforces aspect ratio and clamps height into [120, 400] when keepRatio is true', () => {
      // 4:3 aspect ratio item (width 300, height 225 -> ratio = 0.75)
      const oldBox = { x: 0, y: 0, width: 300, height: 225 };

      // Resize to width 400 -> height = 400 * 0.75 = 300
      const box1 = calculateTransformedBounds(oldBox, { x: 0, y: 0, width: 400, height: 350 }, true);
      expect(box1.width).toBe(400);
      expect(box1.height).toBe(300);

      // Attempt to shrink height below ASPECT_LOCKED_MIN_HEIGHT (120)
      // width 100 -> natural height 75 < 120 -> height clamped to 120, width clamped to 160
      const box2 = calculateTransformedBounds(oldBox, { x: 0, y: 0, width: 100, height: 80 }, true);
      expect(box2.height).toBe(ASPECT_LOCKED_MIN_HEIGHT);
      expect(box2.width).toBe(Math.round(ASPECT_LOCKED_MIN_HEIGHT / 0.75)); // 160

      // Attempt to expand height above ASPECT_LOCKED_MAX_HEIGHT (400)
      // width 800 -> natural height 600 > 400 -> height clamped to 400, width clamped to 533
      const box3 = calculateTransformedBounds(oldBox, { x: 0, y: 0, width: 800, height: 600 }, true);
      expect(box3.height).toBe(ASPECT_LOCKED_MAX_HEIGHT);
      expect(box3.width).toBe(Math.round(ASPECT_LOCKED_MAX_HEIGHT / 0.75)); // 533
    });

    it('handleTransformEnd commits normalized geometry and records RESIZE undo action', () => {
      const onRecordUndoAction = vi.fn();
      const onUpdateItemLocal = vi.fn();
      const onPersistGeometry = vi.fn();

      const { handleTransformEnd } = renderItemTransform({
        onRecordUndoAction,
        onUpdateItemLocal,
        onPersistGeometry,
      });

      let currentW = 200;
      let currentH = 150;
      let scaleX = 1.5;
      let scaleY = 1.5;

      const mockNode = {
        scaleX: (v?: number) => {
          if (v !== undefined) scaleX = v;
          return scaleX;
        },
        scaleY: (v?: number) => {
          if (v !== undefined) scaleY = v;
          return scaleY;
        },
        width: (v?: number) => {
          if (v !== undefined) currentW = v;
          return currentW;
        },
        height: (v?: number) => {
          if (v !== undefined) currentH = v;
          return currentH;
        },
        x: () => 100,
        y: () => 100,
      };

      // Transform end on non-aspect-locked item2 (text)
      handleTransformEnd(mockNode as any, item2);

      // Scale reset to 1
      expect(scaleX).toBe(1);
      expect(scaleY).toBe(1);

      // Dimensions scaled by 1.5: 200 * 1.5 = 300, 150 * 1.5 = 225
      expect(onUpdateItemLocal).toHaveBeenCalledWith('item-2', {
        x: 100,
        y: 100,
        width: 300,
        height: 225,
      });
      expect(onPersistGeometry).toHaveBeenCalledWith('item-2', {
        x: 100,
        y: 100,
        width: 300,
        height: 225,
        zIndex: 2,
      });
      expect(onRecordUndoAction).toHaveBeenCalledWith({
        type: 'RESIZE',
        itemId: 'item-2',
        prevGeometry: { x: 400, y: 300, width: 240, height: 160, zIndex: 2 },
        nextGeometry: { x: 100, y: 100, width: 300, height: 225, zIndex: 2 },
      });
    });
  });

  // =========================================================================
  // 4. useCanvasKeyboardShortcuts
  // =========================================================================
  describe('useCanvasKeyboardShortcuts — Centralized Keybindings', () => {
    function renderKeyboardShortcuts(opts: Parameters<typeof useCanvasKeyboardShortcuts>[0]) {
      let result!: ReturnType<typeof useCanvasKeyboardShortcuts>;
      function Harness() {
        result = useCanvasKeyboardShortcuts(opts);
        return null;
      }
      ReactDOMServer.renderToString(React.createElement(Harness));
      return result;
    }

    it('ignores all shortcuts when an input or editable element is focused', () => {
      const onDeleteSelected = vi.fn();
      const onClearSelection = vi.fn();
      const onSelectAll = vi.fn();

      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: ['item-1'],
        isTextInputActive: () => true, // FOCUSED INPUT
        onDeleteSelected,
        onClearSelection,
        onSelectAll,
      });

      handleKeyDown({ key: 'Delete', preventDefault: vi.fn() } as any);
      handleKeyDown({ key: 'Escape', preventDefault: vi.fn() } as any);
      handleKeyDown({ key: 'a', metaKey: true, preventDefault: vi.fn() } as any);

      expect(onDeleteSelected).not.toHaveBeenCalled();
      expect(onClearSelection).not.toHaveBeenCalled();
      expect(onSelectAll).not.toHaveBeenCalled();
    });

    it('triggers onDeleteSelected on Delete or Backspace when items are selected', () => {
      const onDeleteSelected = vi.fn();
      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: ['item-1', 'item-2'],
        isTextInputActive: () => false,
        onDeleteSelected,
      });

      handleKeyDown({ key: 'Delete', preventDefault: vi.fn() } as any);
      expect(onDeleteSelected).toHaveBeenCalledTimes(1);

      handleKeyDown({ key: 'Backspace', preventDefault: vi.fn() } as any);
      expect(onDeleteSelected).toHaveBeenCalledTimes(2);
    });

    it('triggers onSelectAll on Cmd/Ctrl + A', () => {
      const onSelectAll = vi.fn();
      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: ['item-1'],
        isTextInputActive: () => false,
        onSelectAll,
      });

      handleKeyDown({ key: 'a', metaKey: true, preventDefault: vi.fn() } as any);
      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('triggers onDuplicateSelected on Cmd/Ctrl + D', () => {
      const onDuplicateSelected = vi.fn();
      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: ['item-1'],
        isTextInputActive: () => false,
        onDuplicateSelected,
      });

      handleKeyDown({ key: 'd', ctrlKey: true, preventDefault: vi.fn() } as any);
      expect(onDuplicateSelected).toHaveBeenCalledTimes(1);
    });

    it('triggers onClearSelection and switches tool to select on Escape', () => {
      const onClearSelection = vi.fn();
      const onToolChange = vi.fn();
      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: ['item-1'],
        isTextInputActive: () => false,
        onClearSelection,
        onToolChange,
      });

      handleKeyDown({ key: 'Escape', preventDefault: vi.fn() } as any);
      expect(onClearSelection).toHaveBeenCalled();
      expect(onToolChange).toHaveBeenCalledWith('select');
    });

    it('nudges selected items by 1px on arrow keys, and 10px with Shift', () => {
      const onNudgeSelected = vi.fn();
      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: ['item-1'],
        isTextInputActive: () => false,
        onNudgeSelected,
      });

      // Normal arrow keys: 1px step
      handleKeyDown({ key: 'ArrowLeft', shiftKey: false, preventDefault: vi.fn() } as any);
      expect(onNudgeSelected).toHaveBeenCalledWith(-1, 0);

      handleKeyDown({ key: 'ArrowUp', shiftKey: false, preventDefault: vi.fn() } as any);
      expect(onNudgeSelected).toHaveBeenCalledWith(0, -1);

      // Shift + arrow keys: 10px step
      handleKeyDown({ key: 'ArrowRight', shiftKey: true, preventDefault: vi.fn() } as any);
      expect(onNudgeSelected).toHaveBeenCalledWith(10, 0);

      handleKeyDown({ key: 'ArrowDown', shiftKey: true, preventDefault: vi.fn() } as any);
      expect(onNudgeSelected).toHaveBeenCalledWith(0, 10);
    });

    it('switches tools on P (Pen), E / Shift+P (Eraser), V (Select)', () => {
      const onToolChange = vi.fn();
      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: [],
        isTextInputActive: () => false,
        onToolChange,
      });

      handleKeyDown({ key: 'p', shiftKey: false, preventDefault: vi.fn() } as any);
      expect(onToolChange).toHaveBeenCalledWith('pen');

      handleKeyDown({ key: 'e', shiftKey: false, preventDefault: vi.fn() } as any);
      expect(onToolChange).toHaveBeenCalledWith('eraser');

      handleKeyDown({ key: 'p', shiftKey: true, preventDefault: vi.fn() } as any);
      expect(onToolChange).toHaveBeenCalledWith('eraser');

      handleKeyDown({ key: 'v', shiftKey: false, preventDefault: vi.fn() } as any);
      expect(onToolChange).toHaveBeenCalledWith('select');
    });

    it('blocks mutation shortcuts when readOnly is true', () => {
      const onDeleteSelected = vi.fn();
      const onDuplicateSelected = vi.fn();
      const onNudgeSelected = vi.fn();

      const { handleKeyDown } = renderKeyboardShortcuts({
        selectedIds: ['item-1'],
        readOnly: true,
        isTextInputActive: () => false,
        onDeleteSelected,
        onDuplicateSelected,
        onNudgeSelected,
      });

      handleKeyDown({ key: 'Delete', preventDefault: vi.fn() } as any);
      handleKeyDown({ key: 'd', metaKey: true, preventDefault: vi.fn() } as any);
      handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as any);

      expect(onDeleteSelected).not.toHaveBeenCalled();
      expect(onDuplicateSelected).not.toHaveBeenCalled();
      expect(onNudgeSelected).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Architectural Invariants
  // =========================================================================
  describe('Architectural Invariants & Constants', () => {
    it('uses the single authoritative CLICK_VS_DRAG_THRESHOLD_PX (4)', () => {
      expect(CLICK_VS_DRAG_THRESHOLD_PX).toBe(4);
    });

    it('uses the single authoritative CORNER_PRIORITY_ZONE_PX (20)', () => {
      expect(CORNER_PRIORITY_ZONE_PX).toBe(20);
    });

    it('isKeyboardTargetActive safely returns false in SSR/Node', () => {
      expect(isKeyboardTargetActive()).toBe(false);
    });
  });
});
