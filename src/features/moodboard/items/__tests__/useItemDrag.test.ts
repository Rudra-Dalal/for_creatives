import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useItemDrag } from '../useItemDrag';
import type { UseItemDragCallbacks, UseItemDragReturn } from '../useItemDrag';
import type { MoodboardItem } from '../../types';

// ---------------------------------------------------------------------------
// Mock Konva Node & Stage Factories
// ---------------------------------------------------------------------------

function createMockKonvaNode(id: string, initialX = 0, initialY = 0) {
  let _x = initialX;
  let _y = initialY;
  return {
    id: () => id,
    x: (val?: number) => {
      if (typeof val === 'number') _x = val;
      return _x;
    },
    y: (val?: number) => {
      if (typeof val === 'number') _y = val;
      return _y;
    },
    moveToTop: vi.fn(),
    findAncestor: vi.fn(),
  };
}

function createMockStage(nodes: Array<ReturnType<typeof createMockKonvaNode>>) {
  const map = new Map<string, ReturnType<typeof createMockKonvaNode>>();
  for (const n of nodes) {
    map.set(n.id(), n);
  }
  return {
    findOne: (selector: string) => {
      const id = selector.startsWith('#') ? selector.slice(1) : selector;
      return map.get(id) ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Hook Test Harness
// ---------------------------------------------------------------------------

function renderItemDrag(callbacks: UseItemDragCallbacks): UseItemDragReturn {
  let result!: UseItemDragReturn;
  function Harness() {
    result = useItemDrag(callbacks);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('useItemDrag — Actual Hook Integration Tests', () => {
  const itemA: MoodboardItem = {
    id: 'item-a',
    project_id: 'mb-1',
    reference_id: null,
    type: 'reference',
    x: 100,
    y: 100,
    width: 300,
    height: 220,
    z_index: 1,
    content: {},
    created_at: '',
    updated_at: '',
    deleted_at: null,
  };

  const itemB: MoodboardItem = {
    id: 'item-b',
    project_id: 'mb-1',
    reference_id: null,
    type: 'text',
    x: 450,
    y: 200,
    width: 240,
    height: 160,
    z_index: 2,
    content: {},
    created_at: '',
    updated_at: '',
    deleted_at: null,
  };

  const itemC: MoodboardItem = {
    id: 'item-c',
    project_id: 'mb-1',
    reference_id: null,
    type: 'color',
    x: 800,
    y: 400,
    width: 180,
    height: 180,
    z_index: 3,
    content: {},
    created_at: '',
    updated_at: '',
    deleted_at: null,
  };

  let nodeA: ReturnType<typeof createMockKonvaNode>;
  let nodeB: ReturnType<typeof createMockKonvaNode>;
  let nodeC: ReturnType<typeof createMockKonvaNode>;
  let stageRef: React.RefObject<any>;

  let onSelectIds: ReturnType<typeof vi.fn>;
  let onUpdateItemLocal: ReturnType<typeof vi.fn>;
  let onPersistGeometry: ReturnType<typeof vi.fn>;
  let onRecordUndoAction: ReturnType<typeof vi.fn>;
  let onBringToFront: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodeA = createMockKonvaNode('item-a', 100, 100);
    nodeB = createMockKonvaNode('item-b', 450, 200);
    nodeC = createMockKonvaNode('item-c', 800, 400);

    const mockStage = createMockStage([nodeA, nodeB, nodeC]);
    stageRef = { current: mockStage };

    onSelectIds = vi.fn();
    onUpdateItemLocal = vi.fn();
    onPersistGeometry = vi.fn();
    onRecordUndoAction = vi.fn();
    onBringToFront = vi.fn();

    globalThis.requestAnimationFrame = vi.fn().mockImplementation((cb: () => void) => {
      return setTimeout(cb, 16) as unknown as number;
    });
    globalThis.cancelAnimationFrame = vi.fn().mockImplementation((id: number) => {
      clearTimeout(id);
    });
  });

  // =========================================================================
  // Multi-item live synchronization
  // =========================================================================
  describe('Multi-item live synchronization during dragMove', () => {
    it('propagates primary displacement (dx, dy) to sibling selected Konva nodes imperatively', () => {
      const hook = renderItemDrag({
        items: [itemA, itemB, itemC],
        selectedIds: ['item-a', 'item-b'],
        readOnly: false,
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      // 1. Drag starts on item-a
      hook.handleItemDragStart(itemA);
      expect(nodeA.moveToTop).toHaveBeenCalled();
      expect(nodeB.moveToTop).toHaveBeenCalled();

      // 2. Simulate primary node moving to (170, 150) -> dx: +70, dy: +50
      nodeA.x(170);
      nodeA.y(150);
      const consumed = hook.handleStageDragMove({ target: nodeA } as any);

      expect(consumed).toBe(true);

      // Sibling selected node-b must be moved to (450 + 70, 200 + 50) = (520, 250)
      expect(nodeB.x()).toBe(520);
      expect(nodeB.y()).toBe(250);

      // Unselected node-c must remain completely untouched
      expect(nodeC.x()).toBe(800);
      expect(nodeC.y()).toBe(400);

      // liveDragPositionsRef must track both active positions
      expect(hook.liveDragPositionsRef.current.get('item-a')).toEqual({ x: 170, y: 150 });
      expect(hook.liveDragPositionsRef.current.get('item-b')).toEqual({ x: 520, y: 250 });
      expect(hook.liveDragPositionsRef.current.has('item-c')).toBe(false);
    });

    it('resolves item ancestor when dragMove target is a child shape without an id', () => {
      const hook = renderItemDrag({
        items: [itemA, itemB],
        selectedIds: ['item-a'],
        readOnly: false,
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      hook.handleItemDragStart(itemA);

      // Child node (e.g. Text or Rect inside group)
      const childShape = {
        id: () => '',
        findAncestor: vi.fn().mockReturnValue(nodeA),
      };

      nodeA.x(130);
      nodeA.y(120);

      const consumed = hook.handleStageDragMove({ target: childShape } as any);
      expect(consumed).toBe(true);
      expect(childShape.findAncestor).toHaveBeenCalledWith('.moodboard-item', true);
      expect(hook.liveDragPositionsRef.current.get('item-a')).toEqual({ x: 130, y: 120 });
    });

    it('ignores stage background drag events (e.target === stageRef.current)', () => {
      const hook = renderItemDrag({
        items: [itemA],
        selectedIds: ['item-a'],
        readOnly: false,
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      const consumed = hook.handleStageDragMove({ target: stageRef.current } as any);
      expect(consumed).toBe(false);
    });
  });

  // =========================================================================
  // Multi-item dragEnd commit
  // =========================================================================
  describe('Multi-item dragEnd commit', () => {
    it('commits calculated positions, persists geometry, and records undo for all selected items', () => {
      const hook = renderItemDrag({
        items: [itemA, itemB, itemC],
        selectedIds: ['item-a', 'item-b'],
        readOnly: false,
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      hook.handleItemDragStart(itemA);

      // Final position of item-a: (180, 160) -> dx = +80, dy = +60
      hook.handleItemDragEnd('item-a', 180, 160);

      // Item A committed
      expect(onUpdateItemLocal).toHaveBeenCalledWith('item-a', {
        x: 180,
        y: 160,
        width: itemA.width,
        height: itemA.height,
      });
      expect(onPersistGeometry).toHaveBeenCalledWith('item-a', {
        x: 180,
        y: 160,
        width: itemA.width,
        height: itemA.height,
        zIndex: itemA.z_index,
      });

      // Item B committed with identical offset: (450 + 80, 200 + 60) = (530, 260)
      expect(onUpdateItemLocal).toHaveBeenCalledWith('item-b', {
        x: 530,
        y: 260,
        width: itemB.width,
        height: itemB.height,
      });
      expect(onPersistGeometry).toHaveBeenCalledWith('item-b', {
        x: 530,
        y: 260,
        width: itemB.width,
        height: itemB.height,
        zIndex: itemB.z_index,
      });

      // Unselected item-c untouched
      expect(onUpdateItemLocal).not.toHaveBeenCalledWith('item-c', expect.anything());

      // Undo actions recorded for both items
      expect(onRecordUndoAction).toHaveBeenCalledTimes(2);
      expect(onRecordUndoAction).toHaveBeenCalledWith({
        type: 'MOVE',
        itemId: 'item-a',
        prevGeometry: { x: 100, y: 100, width: 300, height: 220, zIndex: 1 },
        nextGeometry: { x: 180, y: 160, width: 300, height: 220, zIndex: 1 },
      });
      expect(onRecordUndoAction).toHaveBeenCalledWith({
        type: 'MOVE',
        itemId: 'item-b',
        prevGeometry: { x: 450, y: 200, width: 240, height: 160, zIndex: 2 },
        nextGeometry: { x: 530, y: 260, width: 240, height: 160, zIndex: 2 },
      });

      // Bring to front called for both
      expect(onBringToFront).toHaveBeenCalledWith('item-a');
      expect(onBringToFront).toHaveBeenCalledWith('item-b');

      // Live drag state cleared after commit
      expect(hook.liveDragPositionsRef.current.size).toBe(0);
    });
  });

  // =========================================================================
  // Single-item dragEnd commit
  // =========================================================================
  describe('Single-item dragEnd commit', () => {
    it('commits only the dragged item when single item is selected', () => {
      const hook = renderItemDrag({
        items: [itemA, itemB],
        selectedIds: ['item-a'],
        readOnly: false,
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      hook.handleItemDragStart(itemA);
      hook.handleItemDragEnd('item-a', 250, 350);

      expect(onUpdateItemLocal).toHaveBeenCalledTimes(1);
      expect(onUpdateItemLocal).toHaveBeenCalledWith('item-a', {
        x: 250,
        y: 350,
        width: 300,
        height: 220,
      });
      expect(onPersistGeometry).toHaveBeenCalledTimes(1);
      expect(onPersistGeometry).toHaveBeenCalledWith('item-a', {
        x: 250,
        y: 350,
        width: 300,
        height: 220,
        zIndex: 1,
      });
      expect(onBringToFront).toHaveBeenCalledWith('item-a');
      expect(onBringToFront).not.toHaveBeenCalledWith('item-b');
      expect(hook.liveDragPositionsRef.current.size).toBe(0);
    });
  });

  // =========================================================================
  // Selection Normalization
  // =========================================================================
  describe('Selection Normalization', () => {
    it('snaps selection to the dragged item if it was not part of current selection', () => {
      const hook = renderItemDrag({
        items: [itemA, itemB],
        selectedIds: ['item-b'], // item-a is NOT selected
        readOnly: false,
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      hook.handleItemDragStart(itemA);

      // Must call onSelectIds with ['item-a'] to normalize selection
      expect(onSelectIds).toHaveBeenCalledWith(['item-a']);
      expect(nodeA.moveToTop).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ReadOnly Guards
  // =========================================================================
  describe('ReadOnly Guards', () => {
    it('suppresses dragStart and dragEnd completely when readOnly is true', () => {
      const hook = renderItemDrag({
        items: [itemA, itemB],
        selectedIds: ['item-a'],
        readOnly: true, // READ-ONLY
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      hook.handleItemDragStart(itemA);
      expect(nodeA.moveToTop).not.toHaveBeenCalled();
      expect(onSelectIds).not.toHaveBeenCalled();

      hook.handleItemDragEnd('item-a', 300, 300);
      expect(onUpdateItemLocal).not.toHaveBeenCalled();
      expect(onPersistGeometry).not.toHaveBeenCalled();
      expect(onRecordUndoAction).not.toHaveBeenCalled();
      expect(onBringToFront).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Queued Dimension Correction
  // =========================================================================
  describe('Queued Dimension Correction during Active Drag', () => {
    it('queues dimension correction mid-drag and applies it atomically at dragEnd', () => {
      const hook = renderItemDrag({
        items: [itemA],
        selectedIds: ['item-a'],
        readOnly: false,
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      hook.handleItemDragStart(itemA);

      // Simulate mid-drag position
      nodeA.x(120);
      nodeA.y(110);
      hook.handleStageDragMove({ target: nodeA } as any);

      // Trigger dimension correction while item is mid-drag
      hook.handleDimensionsCorrected('item-a', 320, 240);

      // Should NOT update immediately mid-gesture
      expect(onUpdateItemLocal).not.toHaveBeenCalled();
      expect(onPersistGeometry).not.toHaveBeenCalled();

      // Now drag finishes
      hook.handleItemDragEnd('item-a', 120, 110);

      // Atomic commit with the corrected dimensions!
      expect(onUpdateItemLocal).toHaveBeenCalledWith('item-a', {
        x: 120,
        y: 110,
        width: 320,
        height: 240,
      });
      expect(onPersistGeometry).toHaveBeenCalledWith('item-a', {
        x: 120,
        y: 110,
        width: 320,
        height: 240,
        zIndex: 1,
      });
    });

    it('applies dimension correction immediately when item is not mid-drag', () => {
      const hook = renderItemDrag({
        items: [itemA],
        selectedIds: ['item-a'],
        readOnly: false,
        stageRef,
        onSelectIds,
        onUpdateItemLocal,
        onPersistGeometry,
        onRecordUndoAction,
        onBringToFront,
      });

      // No drag started
      hook.handleDimensionsCorrected('item-a', 350, 260);

      expect(onUpdateItemLocal).toHaveBeenCalledWith('item-a', {
        width: 350,
        height: 260,
      });
      expect(onPersistGeometry).toHaveBeenCalledWith('item-a', {
        x: 100,
        y: 100,
        width: 350,
        height: 260,
        zIndex: 1,
      });
    });
  });
});
