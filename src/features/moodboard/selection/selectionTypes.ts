import type Konva from 'konva';
import type { MoodboardItem } from '../types';

/**
 * Geometric bounding box of an active marquee selection rectangle in canvas coordinates.
 */
export interface MarqueeBox {
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Selection update mode when manipulating the selection set.
 */
export type SelectionMode = 'replace' | 'extend' | 'toggle';

/**
 * Bounding box passed into Konva Transformer boundBoxFunc.
 */
export interface TransformBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/**
 * Callbacks required by useSelection.
 */
export interface UseSelectionOptions {
  /** Initial selected item IDs. */
  initialSelectedIds?: string[];
  /** Controlled external selected IDs. */
  selectedIds?: string[];
  /** External callback invoked whenever selection changes. */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Whether canvas is in read-only mode. */
  readOnly?: boolean;
}

/**
 * Return interface for useSelection hook.
 */
export interface UseSelectionReturn {
  /** The current authoritative list of selected item IDs. */
  selectedIds: string[];
  /** Set selection to a single item ID, or clear if null. */
  select: (id: string | null) => void;
  /** Toggle an item's selection status (Shift-click style). */
  toggleSelect: (id: string) => void;
  /** Set selection to an explicit array of IDs. */
  setSelection: (ids: string[]) => void;
  /** Add IDs to the current selection set without removing existing ones. */
  extendSelection: (ids: string[]) => void;
  /** Clear all selected items. */
  clearSelection: () => void;
  /** Select all items in the given array of IDs. */
  selectAll: (allIds: string[]) => void;
  /** Click handler taking shift state into account. */
  handleClick: (id: string, isShiftPressed?: boolean) => void;
  /**
   * Pointer down handler: preserves multi-selection when clicking an already-selected
   * item so that drag can move the entire group.
   */
  handlePointerDownItem: (id: string, isShiftPressed?: boolean) => void;
  /**
   * Click-vs-drag collapse: collapses multi-selection to a single item only if
   * total pointer movement was <= CLICK_VS_DRAG_THRESHOLD_PX.
   */
  handleClickVsDragCollapse: (id: string, dragDistancePx: number) => void;
  /** Returns true if the given ID is selected. */
  isSelected: (id: string) => boolean;
  /** Total number of selected items. */
  selectedCount: number;
  /** Whether exactly one item is selected. */
  isSingleSelection: boolean;
  /** Whether at least one item is selected. */
  hasSelection: boolean;
}

/**
 * Options for useMarquee hook.
 */
export interface UseMarqueeOptions {
  /** Items currently on canvas for intersection testing. */
  items: MoodboardItem[];
  /** Live viewport transform (x, y, scale). */
  viewport: { x: number; y: number; scale: number };
  /** Ref to Konva Stage for resolving pointer canvas coordinates. */
  stageRef: React.RefObject<Konva.Stage | null>;
  /** Authoritative selection setter. */
  onSelectIds: (ids: string[]) => void;
  /** Currently selected IDs before marquee starts. */
  selectedIds: string[];
  /** Whether marquee selection is enabled (only enabled in 'select' tool mode and not readOnly). */
  enabled?: boolean;
}

/**
 * Return interface for useMarquee hook.
 */
export interface UseMarqueeReturn {
  /** Active marquee bounding box for visual rendering, or null if inactive. */
  selectionBox: MarqueeBox | null;
  /** Whether a marquee drag gesture is currently in progress. */
  isMarqueeActive: boolean;
  /** Handler attached to Stage onMouseDown / onTouchStart. */
  handleStageMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  /** Handler attached to Stage onMouseMove / onTouchMove. */
  handleStageMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  /** Handler attached to Stage onMouseUp / onTouchEnd / onMouseLeave. */
  handleStageMouseUp: () => void;
  /** Abort active marquee selection immediately (e.g. on Escape or blur). */
  cancelMarquee: () => void;
}

/**
 * Options for useCanvasKeyboardShortcuts.
 */
export interface UseCanvasKeyboardShortcutsOptions {
  /** Currently selected item IDs. */
  selectedIds: string[];
  /** Whether canvas is in read-only mode. */
  readOnly?: boolean;
  /** Callback to delete selected items. */
  onDeleteSelected?: () => void;
  /** Callback to select all items. */
  onSelectAll?: () => void;
  /** Callback to clear selection. */
  onClearSelection?: () => void;
  /** Callback to duplicate selected items. */
  onDuplicateSelected?: () => void;
  /** Callback to nudge selected items by delta (dx, dy). */
  onNudgeSelected?: (dx: number, dy: number) => void;
  /** Callback to trigger canvas undo. */
  onUndo?: () => void;
  /** Callback to trigger canvas redo. */
  onRedo?: () => void;
  /** Callback to switch active tool. */
  onToolChange?: (tool: 'select' | 'pen' | 'eraser') => void;
  /** Custom check for whether a text input / modal is currently capturing keystrokes. */
  isTextInputActive?: () => boolean;
}
