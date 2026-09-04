'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import Konva from 'konva';
import type {
  MoodboardItem,
  CanvasViewport,
  TextItemContent,
  ColorItemContent,
  IdeaItemContent,
} from '../types';
import type { UndoAction } from '../hooks/useMoodboard';
import { CanvasReferenceItem } from './CanvasReferenceItem';
import { CanvasImageItem } from './CanvasImageItem';
import { CanvasTextItem } from './CanvasTextItem';
import { CanvasColorItem } from './CanvasColorItem';
import { CanvasIdeaItem } from './CanvasIdeaItem';
import { CanvasTransformer } from './CanvasTransformer';
import { HexColorPicker } from 'react-colorful';
import { Compass } from 'lucide-react';

interface MoodboardStageProps {
  items: MoodboardItem[];
  selectedId: string | null;
  selectedIds?: string[];
  viewport: CanvasViewport;
  readOnly?: boolean;
  referenceDirectionCounts?: Map<string, number>;
  onInspectReferenceDirection?: (referenceId: string) => void;
  onPromoteIdeaToDirection?: (title: string, notes?: string) => Promise<void>;
  onViewportChange: (viewport: CanvasViewport) => void;
  onSelectId: (id: string | null) => void;
  onSelectIds?: (ids: string[]) => void;
  onToggleSelectId?: (id: string, isMulti?: boolean) => void;
  onDeleteSelected?: () => void;
  onDuplicateSelected?: () => void;
  onNudgeSelected?: (dx: number, dy: number) => void;
  onUpdateItemLocal: (
    id: string,
    updates: Partial<Pick<MoodboardItem, 'x' | 'y' | 'width' | 'height' | 'z_index' | 'content'>>
  ) => void;
  onPersistGeometry: (
    id: string,
    geometry: { x: number; y: number; width: number; height: number; zIndex?: number }
  ) => void;
  onBringToFront: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateColor: (id: string, hex: string, label?: string) => void;
  onUpdateIdea: (id: string, title: string, notes?: string) => void;
  onDuplicateItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onDropReference: (referenceData: unknown, canvasPosition: { x: number; y: number }) => void;
  onDropFiles: (files: FileList, canvasPosition: { x: number; y: number }) => void;
  onUndo?: () => void;
  onNudge?: (id: string, dx: number, dy: number) => void;
  onZoomToFit?: (containerWidth?: number, containerHeight?: number) => void;
  onRecordUndoAction?: (action: UndoAction) => void;
  onRegisterExport?: (exporter: (customName?: string) => Promise<boolean>) => void;
}

export function MoodboardStage({
  items,
  selectedId,
  selectedIds,
  viewport,
  readOnly = false,
  referenceDirectionCounts,
  onInspectReferenceDirection,
  onPromoteIdeaToDirection,
  onViewportChange,
  onSelectId,
  onSelectIds,
  onToggleSelectId,
  onDeleteSelected,
  onDuplicateSelected,
  onNudgeSelected,
  onUpdateItemLocal,
  onPersistGeometry,
  onBringToFront,
  onUpdateText,
  onUpdateColor,
  onUpdateIdea,
  onDuplicateItem,
  onDeleteItem,
  onDropReference,
  onDropFiles,
  onUndo,
  onNudge,
  onZoomToFit,
  onRecordUndoAction,
  onRegisterExport,
}: MoodboardStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const initialGeometryRef = useRef<Map<string, { x: number; y: number; width: number; height: number; zIndex?: number }>>(new Map());

  const effectiveSelectedIds = React.useMemo(() => {
    if (selectedIds && selectedIds.length > 0) return selectedIds;
    if (selectedId) return [selectedId];
    return [];
  }, [selectedIds, selectedId]);

  const isImageOrReferenceSelected = React.useMemo(() => {
    return items.some(
      (item) =>
        effectiveSelectedIds.includes(item.id) &&
        (item.type === 'reference' || item.type === 'image')
    );
  }, [items, effectiveSelectedIds]);

  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
  }, [items]);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNodes, setSelectedNodes] = useState<Konva.Node[]>([]);
  const [selectedNode, setSelectedNode] = useState<Konva.Node | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nodeMapRef = useRef<Map<string, Konva.Node>>(new Map());

  // Marquee selection box state (Windows desktop / Figma style)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  } | null>(null);
  const isMarqueeSelectingRef = useRef(false);
  const marqueeStartPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastMarqueeHitIdsRef = useRef<string[]>([]);

  // Middle-mouse drag panning state
  const isMiddlePanningRef = useRef(false);
  const middlePanStartRef = useRef<{ clientX: number; clientY: number; vx: number; vy: number }>({ clientX: 0, clientY: 0, vx: 0, vy: 0 });
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);

  // Editing overlays
  const [editingTextItem, setEditingTextItem] = useState<MoodboardItem | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

  const [editingColorItem, setEditingColorItem] = useState<MoodboardItem | null>(null);
  const [editingColorHex, setEditingColorHex] = useState('');
  const [editingColorLabel, setEditingColorLabel] = useState('');

  const [editingIdeaItem, setEditingIdeaItem] = useState<MoodboardItem | null>(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState('');
  const [editingIdeaNotes, setEditingIdeaNotes] = useState('');

  // Canvas for crisp dotted background pattern that redraws dynamically at current zoom
  const [dotPatternCanvas, setDotPatternCanvas] = useState<HTMLCanvasElement | null>(null);

  // Restrict Konva node dragging strictly to left click (button 0)
  useEffect(() => {
    Konva.dragButtons = [0];
  }, []);

  // Global mouse handlers for middle-mouse drag panning across entire window
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isMiddlePanningRef.current) return;
      e.preventDefault();
      const dx = e.clientX - middlePanStartRef.current.clientX;
      const dy = e.clientY - middlePanStartRef.current.clientY;
      onViewportChange({
        x: middlePanStartRef.current.vx + dx,
        y: middlePanStartRef.current.vy + dy,
        scale: viewport.scale,
      });
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || isMiddlePanningRef.current) {
        if (isMiddlePanningRef.current) {
          isMiddlePanningRef.current = false;
          setIsMiddlePanning(false);
        }
      }
      if (isMarqueeSelectingRef.current) {
        isMarqueeSelectingRef.current = false;
        marqueeStartPointerRef.current = null;
        lastMarqueeHitIdsRef.current = [];
        setSelectionBox(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [viewport.scale, onViewportChange]);

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      // Middle mouse button pressed - start viewport panning
      e.preventDefault();
      isMiddlePanningRef.current = true;
      setIsMiddlePanning(true);
      middlePanStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        vx: viewport.x,
        vy: viewport.y,
      };
    }
  };

  // Redraw dotted background crisply at current zoom scale and device pixel ratio
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scaleFactor = Math.max(0.2, viewport.scale) * dpr;
    const baseGrid = 28;
    const tileSize = Math.max(4, Math.round(baseGrid * scaleFactor));

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#121211';
      ctx.fillRect(0, 0, tileSize, tileSize);

      // Dot radius scales smoothly with zoom so it renders crisply at native screen resolution
      const dotRadius = Math.max(0.8, 1.2 * scaleFactor);
      ctx.fillStyle = '#262622';
      ctx.beginPath();
      ctx.arc(tileSize / 2, tileSize / 2, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      setDotPatternCanvas(canvas);
    }
  }, [viewport.scale]);

  // Resize observer to fill container with exact bounding rect
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();

    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(container);

    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Update selectedNodes and selectedNode when selection changes
  useEffect(() => {
    if (effectiveSelectedIds.length === 0 || !stageRef.current) {
      setSelectedNodes([]);
      setSelectedNode(null);
      return;
    }
    const stage = stageRef.current;
    const nodes = effectiveSelectedIds
      .map((id) => {
        const cached = nodeMapRef.current.get(id);
        if (cached && cached.getStage()) return cached;
        // Direct search function in Konva tree (avoids CSS selector parsing quirks)
        const found = stage.find((n: Konva.Node) => n.id() === id)[0];
        if (found) {
          nodeMapRef.current.set(id, found);
          return found;
        }
        return null;
      })
      .filter((n): n is Konva.Node => !!n);

    setSelectedNodes(nodes);
    setSelectedNode(nodes[0] ?? null);
  }, [effectiveSelectedIds, items]);

  // Keyboard shortcut listener (Undo, Delete, Escape, Duplicate, Nudge, Zoom-to-fit, Spacebar-pan)
  useEffect(() => {
    const isTextInputActive = () => {
      const active = document.activeElement;
      return (
        active?.tagName === 'INPUT' ||
        active?.tagName === 'TEXTAREA' ||
        (active as HTMLElement)?.isContentEditable ||
        Boolean(editingTextItem || editingColorItem || editingIdeaItem)
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTextInputActive()) {
        return;
      }

      // Spacebar pan (Hold Space)
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      // Track Shift key for multi-select
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }

      // Zoom to Fit: Cmd/Ctrl + 0
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        onZoomToFit?.(dimensions.width, dimensions.height);
        return;
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        if (onSelectIds) onSelectIds([]);
        else onSelectId(null);
        return;
      }

      // If read-only mode, block all mutation shortcuts
      if (readOnly) {
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo?.();
        return;
      }

      // Delete: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && effectiveSelectedIds.length > 0) {
        e.preventDefault();
        if (onDeleteSelected) {
          onDeleteSelected();
        } else if (onDeleteItem && effectiveSelectedIds[0]) {
          onDeleteItem(effectiveSelectedIds[0]);
        }
        if (onSelectIds) onSelectIds([]);
        else onSelectId(null);
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && effectiveSelectedIds.length > 0) {
        e.preventDefault();
        if (onDuplicateSelected) {
          onDuplicateSelected();
        } else if (onDuplicateItem && effectiveSelectedIds[0]) {
          onDuplicateItem(effectiveSelectedIds[0]);
        }
        return;
      }

      // Arrow keys nudge: 1px normal, 10px shift
      if (effectiveSelectedIds.length > 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        if (onNudgeSelected) {
          onNudgeSelected(dx, dy);
        } else if (onNudge && effectiveSelectedIds[0]) {
          onNudge(effectiveSelectedIds[0], dx, dy);
        }
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    effectiveSelectedIds,
    dimensions,
    readOnly,
    editingTextItem,
    editingColorItem,
    editingIdeaItem,
    onUndo,
    onDeleteItem,
    onDeleteSelected,
    onDuplicateItem,
    onDuplicateSelected,
    onSelectId,
    onSelectIds,
    onNudge,
    onNudgeSelected,
    onZoomToFit,
  ]);

  // Export stage to PNG
  const handleExportPNG = useCallback(
    async (customName?: string): Promise<boolean> => {
      if (!stageRef.current || items.length === 0) return false;

      // Clear selection so bounding box is not rendered in screenshot
      onSelectId(null);
      setSelectedNode(null);

      // Frame wait
      await new Promise((r) => setTimeout(r, 60));

      try {
        const stage = stageRef.current;
        if (!stage) return false;

        const padding = 40;
        const minX = Math.min(...items.map((i) => i.x)) - padding;
        const minY = Math.min(...items.map((i) => i.y)) - padding;
        const maxX = Math.max(...items.map((i) => i.x + i.width)) + padding;
        const maxY = Math.max(...items.map((i) => i.y + i.height)) + padding;
        const width = Math.max(200, maxX - minX);
        const height = Math.max(200, maxY - minY);

        const currentScale = stage.scaleX() || 1;
        const currentX = stage.x() || 0;
        const currentY = stage.y() || 0;

        const dataUrl = stage.toDataURL({
          x: minX * currentScale + currentX,
          y: minY * currentScale + currentY,
          width: width * currentScale,
          height: height * currentScale,
          pixelRatio: 2,
          mimeType: 'image/png',
        });

        const link = document.createElement('a');
        link.download = `${(customName || 'creative-moodboard')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}-moodboard.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
      } catch (err) {
        console.error('Failed to export canvas image:', err);
        return false;
      }
    },
    [items, onSelectId]
  );

  useEffect(() => {
    if (onRegisterExport) {
      onRegisterExport(handleExportPNG);
    }
  }, [onRegisterExport, handleExportPNG]);

  // Track initial geometry before drag with multi-selection support
  const handleItemDragStart = (item: MoodboardItem) => {
    if (readOnly) return;

    let currentSelection = effectiveSelectedIds;
    if (!currentSelection.includes(item.id)) {
      currentSelection = [item.id];
      if (onSelectIds) onSelectIds([item.id]);
      else onSelectId(item.id);
    }

    dragStartPositionsRef.current.clear();
    currentSelection.forEach((id) => {
      const itm = items.find((i) => i.id === id);
      if (itm) {
        dragStartPositionsRef.current.set(id, { x: itm.x, y: itm.y });
        initialGeometryRef.current.set(id, {
          x: itm.x,
          y: itm.y,
          width: itm.width,
          height: itm.height,
          zIndex: itm.z_index,
        });
        onBringToFront(itm.id);
      }
    });
  };

  // Synchronized drag move for all selected items
  const handleStageDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === stageRef.current) return;

    const draggedNode = e.target;
    const draggedId = draggedNode.id();
    if (!draggedId || effectiveSelectedIds.length <= 1 || !effectiveSelectedIds.includes(draggedId)) {
      return;
    }

    const startPos = dragStartPositionsRef.current.get(draggedId);
    if (!startPos) return;

    const dx = draggedNode.x() - startPos.x;
    const dy = draggedNode.y() - startPos.y;

    effectiveSelectedIds.forEach((id) => {
      if (id === draggedId) return;
      const node = stageRef.current?.findOne(`#${id}`);
      const otherStart = dragStartPositionsRef.current.get(id);
      if (node && otherStart) {
        node.x(otherStart.x + dx);
        node.y(otherStart.y + dy);
      }
    });
  };

  // Handle item drag end with group move & undo tracking
  const handleItemDragEnd = (id: string, x: number, y: number) => {
    if (readOnly) return;

    if (effectiveSelectedIds.length > 1 && effectiveSelectedIds.includes(id)) {
      const startPos = dragStartPositionsRef.current.get(id);
      const dx = startPos ? x - startPos.x : 0;
      const dy = startPos ? y - startPos.y : 0;

      effectiveSelectedIds.forEach((selectedItemId) => {
        const item = items.find((i) => i.id === selectedItemId);
        if (!item) return;
        const initial = initialGeometryRef.current.get(selectedItemId);
        const finalX = selectedItemId === id ? x : Math.round(item.x + dx);
        const finalY = selectedItemId === id ? y : Math.round(item.y + dy);

        onUpdateItemLocal(selectedItemId, { x: finalX, y: finalY });
        onPersistGeometry(selectedItemId, {
          x: finalX,
          y: finalY,
          width: item.width,
          height: item.height,
          zIndex: item.z_index,
        });

        if (initial && (initial.x !== finalX || initial.y !== finalY)) {
          onRecordUndoAction?.({
            type: 'MOVE',
            itemId: selectedItemId,
            prevGeometry: initial,
            nextGeometry: {
              x: finalX,
              y: finalY,
              width: item.width,
              height: item.height,
              zIndex: item.z_index,
            },
          });
        }
      });
    } else {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      const initial = initialGeometryRef.current.get(id);
      if (initial && (initial.x !== x || initial.y !== y)) {
        onRecordUndoAction?.({
          type: 'MOVE',
          itemId: id,
          prevGeometry: initial,
          nextGeometry: { x, y, width: item.width, height: item.height, zIndex: item.z_index },
        });
      }

      onUpdateItemLocal(id, { x, y });
      onPersistGeometry(id, {
        x,
        y,
        width: item.width,
        height: item.height,
        zIndex: item.z_index,
      });
    }
  };

  // Handle item transform end with undo tracking
  const handleItemTransformEnd = (id: string, x: number, y: number, width: number, height: number) => {
    if (readOnly) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const initial = initialGeometryRef.current.get(id) || {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      zIndex: item.z_index,
    };

    if (initial.width !== width || initial.height !== height || initial.x !== x || initial.y !== y) {
      onRecordUndoAction?.({
        type: 'RESIZE',
        itemId: id,
        prevGeometry: initial,
        nextGeometry: { x, y, width, height, zIndex: item.z_index },
      });
    }

    onUpdateItemLocal(id, { x, y, width, height });
    onPersistGeometry(id, { x, y, width, height, zIndex: item.z_index });
  };

  // Auto-correction of dimensions to match natural aspect ratio without undo pollution
  const handleDimensionsCorrected = (id: string, width: number, height: number) => {
    onUpdateItemLocal(id, { width, height });
    const item = items.find((i) => i.id === id);
    if (item) {
      onPersistGeometry(id, { x: item.x, y: item.y, width, height, zIndex: item.z_index });
    }
  };

  // Mouse wheel zoom centered on cursor
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.08;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? Math.min(oldScale * scaleBy, 3) : Math.max(oldScale / scaleBy, 0.2);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    onViewportChange({
      x: newPos.x,
      y: newPos.y,
      scale: newScale,
    });
  };

  // Drag stage (panning)
  const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === stageRef.current) {
      onViewportChange({
        x: e.target.x(),
        y: e.target.y(),
        scale: viewport.scale,
      });
    }
  };

  const handleItemPointerDown = useCallback(
    (id: string, node: Konva.Node) => {
      nodeMapRef.current.set(id, node);
      // When holding shift, toggle happens on click to allow shift-drag
      if (isShiftPressed) return;

      // If clicking an item that's not currently selected, isolate selection to it immediately!
      if (!effectiveSelectedIds.includes(id)) {
        if (onSelectIds) onSelectIds([id]);
        else onSelectId(id);
        setSelectedNode(node);
        setSelectedNodes([node]);
      }
    },
    [isShiftPressed, effectiveSelectedIds, onSelectIds, onSelectId]
  );

  const handleItemClick = useCallback(
    (id: string, node: Konva.Node) => {
      nodeMapRef.current.set(id, node);
      if (isShiftPressed && onToggleSelectId) {
        onToggleSelectId(id, true);
        setSelectedNodes((prev) =>
          prev.some((n) => n.id() === id)
            ? prev.filter((n) => n.id() !== id)
            : [...prev, node]
        );
      } else {
        // Normal click on a card always isolates selection to this single card
        if (onSelectIds) onSelectIds([id]);
        else onSelectId(id);
        setSelectedNode(node);
        setSelectedNodes([node]);
      }
    },
    [isShiftPressed, onToggleSelectId, onSelectIds, onSelectId]
  );

  // Handle Stage Mouse Down for Marquee selection
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if ('button' in e.evt && e.evt.button === 1) return;
    if (isSpacePressed) return;

    // Fallback: If clicked directly on a card or child of a card
    const clickedItemGroup = e.target.findAncestor('.moodboard-item', true);
    if (clickedItemGroup) {
      isMarqueeSelectingRef.current = false;
      marqueeStartPointerRef.current = null;
      setSelectionBox(null);
      const clickedId = clickedItemGroup.id();
      if (clickedId) {
        handleItemPointerDown(clickedId, clickedItemGroup);
      }
      return;
    }

    const isBackground = e.target === stageRef.current || e.target.name() === 'canvas-background';
    if (!isBackground) return;

    if (editingTextItem) handleSaveTextEdit();
    if (editingColorItem) handleSaveColorEdit();
    if (editingIdeaItem) handleSaveIdeaEdit();

    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const canvasX = (pointer.x - stage.x()) / stage.scaleX();
    const canvasY = (pointer.y - stage.y()) / stage.scaleY();

    isMarqueeSelectingRef.current = true;
    marqueeStartPointerRef.current = { x: canvasX, y: canvasY };
    lastMarqueeHitIdsRef.current = [];
    setSelectionBox({
      startX: canvasX,
      startY: canvasY,
      x: canvasX,
      y: canvasY,
      width: 0,
      height: 0,
      visible: false,
    });

    if (!('shiftKey' in e.evt && e.evt.shiftKey)) {
      if (onSelectIds) onSelectIds([]);
      else onSelectId(null);
      setSelectedNode(null);
      setSelectedNodes([]);
    }
  };

  // Handle Stage Mouse Move for Marquee selection
  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isMarqueeSelectingRef.current || !marqueeStartPointerRef.current) return;

    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const currentCanvasX = (pointer.x - stage.x()) / stage.scaleX();
    const currentCanvasY = (pointer.y - stage.y()) / stage.scaleY();

    const startX = marqueeStartPointerRef.current.x;
    const startY = marqueeStartPointerRef.current.y;

    const boxWidth = Math.abs(currentCanvasX - startX);
    const boxHeight = Math.abs(currentCanvasY - startY);

    // Require minimum 6px drag threshold before marquee selection begins
    if (boxWidth < 6 && boxHeight < 6) {
      return;
    }

    const boxX = Math.min(startX, currentCanvasX);
    const boxY = Math.min(startY, currentCanvasY);

    setSelectionBox({
      startX,
      startY,
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      visible: true,
    });

    const boxRight = boxX + boxWidth;
    const boxBottom = boxY + boxHeight;

    const hitItemIds = items
      .filter((item) => {
        const itemRight = item.x + item.width;
        const itemBottom = item.y + item.height;
        return (
          item.x < boxRight &&
          itemRight > boxX &&
          item.y < boxBottom &&
          itemBottom > boxY
        );
      })
      .map((i) => i.id);

    const targetIds =
      'shiftKey' in e.evt && e.evt.shiftKey
        ? Array.from(new Set([...effectiveSelectedIds, ...hitItemIds]))
        : hitItemIds;

    const prev = lastMarqueeHitIdsRef.current;
    const isDifferent =
      prev.length !== targetIds.length ||
      prev.some((id, idx) => id !== targetIds[idx]);

    if (isDifferent) {
      lastMarqueeHitIdsRef.current = targetIds;
      if (onSelectIds) {
        onSelectIds(targetIds);
      } else if (targetIds.length > 0) {
        onSelectId(targetIds[0]);
      } else {
        onSelectId(null);
      }
    }
  };

  // Handle Stage Mouse Up for Marquee selection
  const handleStageMouseUp = () => {
    if (isMarqueeSelectingRef.current) {
      isMarqueeSelectingRef.current = false;
      marqueeStartPointerRef.current = null;
      lastMarqueeHitIdsRef.current = [];
      setSelectionBox(null);
    }
  };

  // Drag & drop file or reference drawer item
  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDragOver(true);
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDragOver(false);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const canvasX = (clientX - viewport.x) / viewport.scale;
    const canvasY = (clientY - viewport.y) / viewport.scale;

    // Check for native file drops from OS (Desktop/Explorer)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files, { x: Math.round(canvasX - 100), y: Math.round(canvasY - 80) });
      return;
    }

    // Check for Reference Library drawer drop
    const rawData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
    if (rawData) {
      try {
        const refData = JSON.parse(rawData);
        onDropReference(refData, { x: Math.round(canvasX - 140), y: Math.round(canvasY - 100) });
      } catch {
        // Ignored
      }
    }
  };

  // Text item editing overlay
  const handleOpenTextEdit = (item: MoodboardItem) => {
    if (readOnly) return;
    setEditingTextItem(item);
    const content = (item.content as TextItemContent) || { text: '' };
    setEditingTextValue(content.text || '');
  };

  const handleSaveTextEdit = () => {
    if (editingTextItem) {
      onUpdateText(editingTextItem.id, editingTextValue.trim());
      setEditingTextItem(null);
    }
  };

  // Color item editing overlay
  const handleOpenColorEdit = (item: MoodboardItem) => {
    if (readOnly) return;
    setEditingColorItem(item);
    const content = (item.content as ColorItemContent) || { hex: '#D97706', label: '' };
    setEditingColorHex(content.hex || '#D97706');
    setEditingColorLabel(content.label || '');
  };

  const handleSaveColorEdit = () => {
    if (editingColorItem) {
      onUpdateColor(editingColorItem.id, editingColorHex.trim(), editingColorLabel.trim());
      setEditingColorItem(null);
    }
  };

  // Idea item editing overlay
  const handleOpenIdeaEdit = (item: MoodboardItem) => {
    if (readOnly) return;
    setEditingIdeaItem(item);
    const content = (item.content as IdeaItemContent) || { title: '', notes: '' };
    setEditingIdeaTitle(content.title || '');
    setEditingIdeaNotes(content.notes || '');
  };

  const handleSaveIdeaEdit = () => {
    if (editingIdeaItem) {
      onUpdateIdea(editingIdeaItem.id, editingIdeaTitle.trim(), editingIdeaNotes.trim());
      setEditingIdeaItem(null);
    }
  };

  // Calculate screen position for overlay
  const getEditingOverlayStyle = useCallback(
    (targetItem: MoodboardItem | null) => {
      if (!targetItem) return {};
      const screenX = targetItem.x * viewport.scale + viewport.x;
      const screenY = targetItem.y * viewport.scale + viewport.y;
      const screenWidth = targetItem.width * viewport.scale;
      const screenHeight = targetItem.height * viewport.scale;

      return {
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${Math.max(screenWidth, 200)}px`,
        minHeight: `${Math.max(screenHeight, 140)}px`,
        fontSize: `${Math.max(12, 14 * viewport.scale)}px`,
      };
    },
    [viewport]
  );

  const selectedItem = items.find((i) => i.id === selectedId);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleContainerMouseDown}
      onAuxClick={(e) => {
        if (e.button === 1) e.preventDefault();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 w-full h-full overflow-hidden select-none bg-[#121211] ${
        isMiddlePanning ? 'cursor-grabbing' : isSpacePressed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      } ${isDragOver ? 'ring-2 ring-inset ring-accent/60' : ''}`}
    >
      {/* Subtle Drag Over Indicator */}
      {isDragOver && (
        <div className="absolute inset-4 z-40 pointer-events-none rounded-xl border-2 border-dashed border-accent/60 bg-accent/5 flex items-center justify-center">
          <div className="rounded-lg bg-surface border border-border px-4 py-2 text-xs font-medium text-foreground shadow-floating">
            Drop image onto creative playground
          </div>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable={isSpacePressed}
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        onDragMove={handleStageDragMove}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={handleStageMouseDown}
        onTouchMove={handleStageMouseMove}
        onTouchEnd={handleStageMouseUp}
      >
        <Layer>
          {/* Dotted Infinite Playground Canvas Background */}
          {dotPatternCanvas ? (
            <Rect
              name="canvas-background"
              x={-50000}
              y={-50000}
              width={100000}
              height={100000}
              fillPatternImage={dotPatternCanvas as unknown as HTMLImageElement}
              fillPatternRepeat="repeat"
              fillPatternScale={{
                x: 28 / dotPatternCanvas.width,
                y: 28 / dotPatternCanvas.height,
              }}
            />
          ) : (
            <Rect
              name="canvas-background"
              x={-50000}
              y={-50000}
              width={100000}
              height={100000}
              fill="#121211"
            />
          )}

          {/* Marquee Selection Rectangle (Windows desktop / Figma style) */}
          {selectionBox && selectionBox.visible && (selectionBox.width > 2 || selectionBox.height > 2) && (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="rgba(217, 119, 6, 0.12)"
              stroke="#d97706"
              strokeWidth={1.5 / viewport.scale}
              dash={[4 / viewport.scale, 4 / viewport.scale]}
              listening={false}
            />
          )}

          {/* Render All 5 Playground Objects in strict z-index order */}
          {sortedItems.map((item) => {
            const isSelected = effectiveSelectedIds.includes(item.id);

            if (item.type === 'text') {
              return (
                <CanvasTextItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  isDraggable={!readOnly}
                  onPointerDown={(node) => handleItemPointerDown(item.id, node)}
                  onSelect={(node) => handleItemClick(item.id, node)}
                  onDragStart={() => handleItemDragStart(item)}
                  onDragEnd={handleItemDragEnd}
                  onTransformEnd={handleItemTransformEnd}
                  onDoubleClick={handleOpenTextEdit}
                />
              );
            }

            if (item.type === 'image') {
              return (
                <CanvasImageItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  isDraggable={!readOnly}
                  onPointerDown={(node) => handleItemPointerDown(item.id, node)}
                  onSelect={(node) => handleItemClick(item.id, node)}
                  onDragStart={() => handleItemDragStart(item)}
                  onDragEnd={handleItemDragEnd}
                  onTransformEnd={handleItemTransformEnd}
                  onDimensionsCorrected={handleDimensionsCorrected}
                />
              );
            }

            if (item.type === 'color') {
              return (
                <CanvasColorItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  isDraggable={!readOnly}
                  onPointerDown={(node) => handleItemPointerDown(item.id, node)}
                  onSelect={(node) => handleItemClick(item.id, node)}
                  onDragStart={() => handleItemDragStart(item)}
                  onDragEnd={handleItemDragEnd}
                  onTransformEnd={handleItemTransformEnd}
                  onDoubleClick={handleOpenColorEdit}
                />
              );
            }

            if (item.type === 'idea') {
              return (
                <CanvasIdeaItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  isDraggable={!readOnly}
                  onPointerDown={(node) => handleItemPointerDown(item.id, node)}
                  onSelect={(node) => handleItemClick(item.id, node)}
                  onDragStart={() => handleItemDragStart(item)}
                  onDragEnd={handleItemDragEnd}
                  onTransformEnd={handleItemTransformEnd}
                  onDoubleClick={handleOpenIdeaEdit}
                />
              );
            }

            // Default: Reference Item
            const linkedCount = item.reference_id && referenceDirectionCounts
              ? (referenceDirectionCounts.get(item.reference_id) || 0)
              : 0;

            return (
              <CanvasReferenceItem
                key={item.id}
                item={item}
                isSelected={isSelected}
                linkedDirectionsCount={linkedCount}
                onInspectDirection={onInspectReferenceDirection}
                isDraggable={!readOnly}
                onPointerDown={(node) => handleItemPointerDown(item.id, node)}
                onSelect={(node) => handleItemClick(item.id, node)}
                onDragStart={() => handleItemDragStart(item)}
                onDragEnd={handleItemDragEnd}
                onTransformEnd={handleItemTransformEnd}
                onDimensionsCorrected={handleDimensionsCorrected}
              />
            );
          })}

          {/* Konva Transformer for resize (hidden in read-only mode) */}
          {!readOnly && (selectedNodes.length > 0 || selectedNode) && (
            <CanvasTransformer
              selectedNode={selectedNode}
              selectedNodes={selectedNodes.length > 0 ? selectedNodes : (selectedNode ? [selectedNode] : [])}
              keepRatio={isImageOrReferenceSelected}
            />
          )}
        </Layer>
      </Stage>

      {/* Floating Editing Overlay for Text Item */}
      {!readOnly && editingTextItem && (
        <div
          style={getEditingOverlayStyle(editingTextItem)}
          className="absolute z-30 p-3 bg-surface border border-accent/60 rounded-lg shadow-floating flex flex-col gap-2"
        >
          <div className="flex items-center justify-between pb-1 border-b border-border text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Edit Text Note</span>
            <span>Press Esc or click outside</span>
          </div>
          <textarea
            autoFocus
            value={editingTextValue}
            onChange={(e) => setEditingTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleSaveTextEdit();
            }}
            onBlur={handleSaveTextEdit}
            placeholder="Type your creative thoughts..."
            className="w-full flex-1 min-h-[80px] bg-transparent text-foreground placeholder-muted-foreground outline-none resize-none font-serif text-sm leading-relaxed select-text selection:bg-accent selection:text-white"
          />
        </div>
      )}

      {/* Floating Editing Overlay for Color Item */}
      {!readOnly && editingColorItem && (
        <div
          style={getEditingOverlayStyle(editingColorItem)}
          className="absolute z-30 p-3 bg-surface border border-accent/60 rounded-lg shadow-floating flex flex-col gap-2.5 w-[220px]"
        >
          <div className="flex items-center justify-between pb-1 border-b border-border text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Edit Color Swatch</span>
            <button
              onClick={handleSaveColorEdit}
              className="text-xs text-accent hover:underline font-medium cursor-pointer"
            >
              Done
            </button>
          </div>
          <div className="flex justify-center [&_.react-colorful]:w-full [&_.react-colorful]:h-[130px] [&_.react-colorful]:rounded">
            <HexColorPicker
              color={editingColorHex.startsWith('#') && editingColorHex.length === 7 ? editingColorHex : '#D97706'}
              onChange={(nextHex) => {
                const hexVal = nextHex.toUpperCase();
                setEditingColorHex(hexVal);
                onUpdateColor(editingColorItem.id, hexVal, editingColorLabel);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 shrink-0 rounded border border-border/80 shadow-sm"
              style={{ backgroundColor: editingColorHex }}
            />
            <input
              type="text"
              value={editingColorHex}
              onChange={(e) => {
                const nextHex = e.target.value.toUpperCase();
                setEditingColorHex(nextHex);
                onUpdateColor(editingColorItem.id, nextHex, editingColorLabel);
              }}
              placeholder="#D97706"
              maxLength={7}
              className="flex-1 rounded bg-surface-subtle px-2 py-1 font-mono text-xs text-foreground border border-border outline-none focus:border-accent"
            />
          </div>
          <input
            type="text"
            value={editingColorLabel}
            onChange={(e) => {
              setEditingColorLabel(e.target.value);
              onUpdateColor(editingColorItem.id, editingColorHex, e.target.value);
            }}
            placeholder="Color label (e.g. Primary Amber)"
            className="w-full rounded bg-surface-subtle px-2 py-1 text-xs text-foreground border border-border outline-none focus:border-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') handleSaveColorEdit();
            }}
          />
        </div>
      )}

      {/* Floating Editing Overlay for Idea Item */}
      {!readOnly && editingIdeaItem && (
        <div
          style={getEditingOverlayStyle(editingIdeaItem)}
          className="absolute z-30 p-3 bg-surface border border-accent/60 rounded-lg shadow-floating flex flex-col gap-2 min-w-[260px]"
        >
          <div className="flex items-center justify-between pb-1 border-b border-border text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Edit Idea</span>
            <div className="flex items-center gap-2">
              {onPromoteIdeaToDirection && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!editingIdeaTitle.trim()) return;
                    await onPromoteIdeaToDirection(editingIdeaTitle, editingIdeaNotes);
                  }}
                  className="text-xs text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  title="Promote to Creative Direction statement"
                >
                  <Compass className="h-3 w-3" />
                  <span>Promote</span>
                </button>
              )}
              <button
                onClick={handleSaveIdeaEdit}
                className="text-xs text-accent hover:underline cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
          <input
            autoFocus
            type="text"
            value={editingIdeaTitle}
            onChange={(e) => setEditingIdeaTitle(e.target.value)}
            placeholder="Idea statement..."
            className="w-full rounded bg-surface-subtle px-2.5 py-1.5 font-display text-sm font-medium text-foreground border border-border outline-none focus:border-accent select-text selection:bg-accent selection:text-white"
          />
          <textarea
            value={editingIdeaNotes}
            onChange={(e) => setEditingIdeaNotes(e.target.value)}
            placeholder="Supporting context, mood, or direction notes..."
            className="w-full min-h-[60px] rounded bg-surface-subtle p-2 text-xs text-muted-foreground border border-border outline-none focus:border-accent resize-none leading-relaxed select-text selection:bg-accent selection:text-white"
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleSaveIdeaEdit();
            }}
          />
        </div>
      )}
    </div>
  );
}
