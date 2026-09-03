'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { moodboardService } from '../services/moodboardService';
import type {
  MoodboardItem,
  CanvasViewport,
  TextItemContent,
  ImageItemContent,
  ColorItemContent,
  IdeaItemContent,
} from '../types';
import type { Json } from '@/types/database.types';
import type { Reference } from '@/features/references/types';

export interface UndoAction {
  type: 'ADD' | 'DELETE' | 'MOVE' | 'RESIZE' | 'DUPLICATE';
  itemId: string;
  item?: MoodboardItem;
  prevGeometry?: { x: number; y: number; width: number; height: number; zIndex?: number };
  nextGeometry?: { x: number; y: number; width: number; height: number; zIndex?: number };
}

export function useMoodboard(projectId: string, initialItems?: MoodboardItem[], readOnly?: boolean) {
  const [items, setItems] = useState<MoodboardItem[]>(initialItems || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>({ x: 0, y: 0, scale: 1 });
  const [isLoading, setIsLoading] = useState(!initialItems);
  const [error, setError] = useState<string | null>(null);

  // Synchronize initialItems if provided (e.g. from bundle)
  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      setIsLoading(false);
    }
  }, [initialItems]);

  // Single-level undo action state
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);

  // Keep track of pending persistence timers for debouncing
  const pendingUpdatesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const fetchItems = useCallback(async () => {
    if (!projectId || (readOnly && initialItems !== undefined)) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await moodboardService.getItems(projectId);
      setItems(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load moodboard items');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, readOnly, initialItems]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getMaxZIndex = useCallback(() => {
    if (items.length === 0) return 1;
    return Math.max(...items.map((item) => item.z_index || 1));
  }, [items]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvasCoords = useCallback(
    (screenX: number, screenY: number, containerRect: DOMRect) => {
      const relativeX = screenX - containerRect.left;
      const relativeY = screenY - containerRect.top;
      const canvasX = (relativeX - viewport.x) / viewport.scale;
      const canvasY = (relativeY - viewport.y) / viewport.scale;
      return { x: canvasX, y: canvasY };
    },
    [viewport]
  );

  // Record an undo action
  const recordUndoAction = useCallback((action: UndoAction) => {
    setLastAction(action);
  }, []);

  // One-level Undo execution
  const undo = useCallback(async () => {
    if (!lastAction) return;

    const actionToRevert = lastAction;
    setLastAction(null); // Clear single-level undo immediately

    try {
      if (actionToRevert.type === 'ADD' || actionToRevert.type === 'DUPLICATE') {
        // Undo Add/Duplicate -> soft delete the item
        setItems((prev) => prev.filter((i) => i.id !== actionToRevert.itemId));
        if (selectedId === actionToRevert.itemId) setSelectedId(null);
        await moodboardService.softDeleteItem(actionToRevert.itemId);
      } else if (actionToRevert.type === 'DELETE' && actionToRevert.item) {
        // Undo Delete -> restore item
        await moodboardService.restoreItem(actionToRevert.itemId);
        setItems((prev) => {
          if (prev.some((i) => i.id === actionToRevert.itemId)) return prev;
          return [...prev, actionToRevert.item!];
        });
        setSelectedId(actionToRevert.itemId);
      } else if (
        (actionToRevert.type === 'MOVE' || actionToRevert.type === 'RESIZE') &&
        actionToRevert.prevGeometry
      ) {
        // Undo Move/Resize -> restore previous geometry
        const prevGeo = actionToRevert.prevGeometry;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== actionToRevert.itemId) return i;
            return {
              ...i,
              x: prevGeo.x,
              y: prevGeo.y,
              width: prevGeo.width,
              height: prevGeo.height,
              z_index: prevGeo.zIndex ?? i.z_index,
            };
          })
        );
        await moodboardService.updateItem(actionToRevert.itemId, {
          x: prevGeo.x,
          y: prevGeo.y,
          width: prevGeo.width,
          height: prevGeo.height,
          zIndex: prevGeo.zIndex,
        });
      }
    } catch (err) {
      console.error('Failed to execute undo:', err);
    }
  }, [lastAction, selectedId]);

  // Add reference item to canvas
  const addReferenceItem = async (
    reference: Reference,
    canvasPosition?: { x: number; y: number }
  ): Promise<MoodboardItem> => {
    const nextZ = getMaxZIndex() + 1;
    const defaultWidth = 300;
    const defaultHeight = 220;

    const x = canvasPosition ? canvasPosition.x : -viewport.x / viewport.scale + 200 + (items.length % 5) * 30;
    const y = canvasPosition ? canvasPosition.y : -viewport.y / viewport.scale + 150 + (items.length % 5) * 30;

    const created = await moodboardService.createItem({
      projectId,
      referenceId: reference.id,
      type: 'reference',
      content: {
        url: reference.url,
        title: reference.title,
        thumbnail_url: reference.thumbnail_url,
        source_domain: reference.source_domain,
      } as unknown as Json,
      x,
      y,
      width: defaultWidth,
      height: defaultHeight,
      zIndex: nextZ,
    });

    const itemWithRef: MoodboardItem = {
      ...created,
      reference,
    };

    setItems((prev) => [...prev, itemWithRef]);
    setSelectedId(created.id);
    recordUndoAction({ type: 'ADD', itemId: created.id, item: itemWithRef });
    return itemWithRef;
  };

  // Add text note to canvas
  const addTextNote = async (
    initialText = 'Creative Note',
    canvasPosition?: { x: number; y: number }
  ): Promise<MoodboardItem> => {
    const nextZ = getMaxZIndex() + 1;
    const defaultWidth = 240;
    const defaultHeight = 160;

    const x = canvasPosition ? canvasPosition.x : -viewport.x / viewport.scale + 240 + (items.length % 5) * 30;
    const y = canvasPosition ? canvasPosition.y : -viewport.y / viewport.scale + 180 + (items.length % 5) * 30;

    const content: TextItemContent = {
      text: initialText,
      fontSize: 14,
      fontFamily: 'Newsreader',
    };

    const created = await moodboardService.createItem({
      projectId,
      referenceId: null,
      type: 'text',
      content: content as unknown as Json,
      x,
      y,
      width: defaultWidth,
      height: defaultHeight,
      zIndex: nextZ,
    });

    setItems((prev) => [...prev, created]);
    setSelectedId(created.id);
    recordUndoAction({ type: 'ADD', itemId: created.id, item: created });
    return created;
  };

  // Add playground image item to canvas
  const addImageItem = async (
    imageUrl: string,
    naturalWidth: number,
    naturalHeight: number,
    fileName = 'Image',
    canvasPosition?: { x: number; y: number }
  ): Promise<MoodboardItem> => {
    const nextZ = getMaxZIndex() + 1;

    const targetWidth = Math.min(360, Math.max(160, naturalWidth));
    const aspectRatio = naturalHeight > 0 && naturalWidth > 0 ? naturalHeight / naturalWidth : 0.75;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    const x = canvasPosition ? canvasPosition.x : -viewport.x / viewport.scale + 200 + (items.length % 5) * 30;
    const y = canvasPosition ? canvasPosition.y : -viewport.y / viewport.scale + 140 + (items.length % 5) * 30;

    const content: ImageItemContent = {
      imageUrl,
      fileName,
      originalWidth: naturalWidth,
      originalHeight: naturalHeight,
    };

    const created = await moodboardService.createItem({
      projectId,
      referenceId: null,
      type: 'image',
      content: content as unknown as Json,
      x,
      y,
      width: targetWidth,
      height: targetHeight,
      zIndex: nextZ,
    });

    setItems((prev) => [...prev, created]);
    setSelectedId(created.id);
    recordUndoAction({ type: 'ADD', itemId: created.id, item: created });
    return created;
  };

  // Add color swatch item to canvas
  const addColorItem = async (
    hex = '#D97706',
    label?: string,
    canvasPosition?: { x: number; y: number }
  ): Promise<MoodboardItem> => {
    const nextZ = getMaxZIndex() + 1;
    const defaultWidth = 180;
    const defaultHeight = 180;

    const x = canvasPosition ? canvasPosition.x : -viewport.x / viewport.scale + 220 + (items.length % 5) * 30;
    const y = canvasPosition ? canvasPosition.y : -viewport.y / viewport.scale + 160 + (items.length % 5) * 30;

    const content: ColorItemContent = {
      hex: hex.toUpperCase(),
      label: label || hex.toUpperCase(),
    };

    const created = await moodboardService.createItem({
      projectId,
      referenceId: null,
      type: 'color',
      content: content as unknown as Json,
      x,
      y,
      width: defaultWidth,
      height: defaultHeight,
      zIndex: nextZ,
    });

    setItems((prev) => [...prev, created]);
    setSelectedId(created.id);
    recordUndoAction({ type: 'ADD', itemId: created.id, item: created });
    return created;
  };

  // Add creative idea item to canvas
  const addIdeaItem = async (
    title = 'Creative Idea',
    notes = '',
    canvasPosition?: { x: number; y: number }
  ): Promise<MoodboardItem> => {
    const nextZ = getMaxZIndex() + 1;
    const defaultWidth = 280;
    const defaultHeight = 180;

    const x = canvasPosition ? canvasPosition.x : -viewport.x / viewport.scale + 200 + (items.length % 5) * 30;
    const y = canvasPosition ? canvasPosition.y : -viewport.y / viewport.scale + 140 + (items.length % 5) * 30;

    const content: IdeaItemContent = {
      title,
      notes,
    };

    const created = await moodboardService.createItem({
      projectId,
      referenceId: null,
      type: 'idea',
      content: content as unknown as Json,
      x,
      y,
      width: defaultWidth,
      height: defaultHeight,
      zIndex: nextZ,
    });

    setItems((prev) => [...prev, created]);
    setSelectedId(created.id);
    recordUndoAction({ type: 'ADD', itemId: created.id, item: created });
    return created;
  };

  // Duplicate an existing item on canvas
  const duplicateItem = async (id: string): Promise<MoodboardItem | null> => {
    const source = items.find((i) => i.id === id);
    if (!source) return null;

    const nextZ = getMaxZIndex() + 1;
    const offsetX = source.x + 30;
    const offsetY = source.y + 30;

    const created = await moodboardService.createItem({
      projectId,
      referenceId: source.reference_id,
      type: source.type,
      content: source.content as unknown as Json,
      x: offsetX,
      y: offsetY,
      width: source.width,
      height: source.height,
      zIndex: nextZ,
    });

    const itemWithRef: MoodboardItem = {
      ...created,
      reference: source.reference,
    };

    setItems((prev) => [...prev, itemWithRef]);
    setSelectedId(created.id);
    recordUndoAction({ type: 'DUPLICATE', itemId: created.id, item: itemWithRef });
    return itemWithRef;
  };

  // Update item local position/size instantly for smooth drag/transform
  const updateItemLocal = useCallback(
    (id: string, updates: Partial<Pick<MoodboardItem, 'x' | 'y' | 'width' | 'height' | 'z_index' | 'content'>>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            ...updates,
          };
        })
      );
    },
    []
  );

  // Persist item position/size to Supabase
  const persistItemGeometry = useCallback(
    (
      id: string,
      geometry: { x: number; y: number; width: number; height: number; zIndex?: number }
    ) => {
      const existing = pendingUpdatesRef.current.get(id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        try {
          await moodboardService.updateItem(id, geometry);
        } catch {
          // Handled
        } finally {
          pendingUpdatesRef.current.delete(id);
        }
      }, 250);

      pendingUpdatesRef.current.set(id, timer);
    },
    []
  );

  // Nudge item position with keyboard arrow keys
  const nudgeItem = useCallback(
    (id: string, dx: number, dy: number) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      const newX = item.x + dx;
      const newY = item.y + dy;

      recordUndoAction({
        type: 'MOVE',
        itemId: id,
        prevGeometry: { x: item.x, y: item.y, width: item.width, height: item.height, zIndex: item.z_index },
        nextGeometry: { x: newX, y: newY, width: item.width, height: item.height, zIndex: item.z_index },
      });

      updateItemLocal(id, { x: newX, y: newY });
      persistItemGeometry(id, {
        x: newX,
        y: newY,
        width: item.width,
        height: item.height,
        zIndex: item.z_index,
      });
    },
    [items, updateItemLocal, persistItemGeometry, recordUndoAction]
  );

  // Update text note content
  const updateTextContent = async (id: string, text: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.type !== 'text') return;

    const existingContent = (item.content as TextItemContent) || { text: '' };
    const updatedContent: TextItemContent = {
      ...existingContent,
      text,
    };

    updateItemLocal(id, { content: updatedContent });

    try {
      await moodboardService.updateItem(id, {
        content: updatedContent as unknown as Json,
      });
    } catch {
      // Handled
    }
  };

  // Update color swatch content
  const updateColorContent = async (id: string, hex: string, label?: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.type !== 'color') return;

    const updatedContent: ColorItemContent = {
      hex: hex.toUpperCase(),
      label: label || hex.toUpperCase(),
    };

    updateItemLocal(id, { content: updatedContent });

    try {
      await moodboardService.updateItem(id, {
        content: updatedContent as unknown as Json,
      });
    } catch {
      // Handled
    }
  };

  // Update creative idea content
  const updateIdeaContent = async (id: string, title: string, notes?: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.type !== 'idea') return;

    const updatedContent: IdeaItemContent = {
      title,
      notes: notes !== undefined ? notes : (item.content as IdeaItemContent).notes,
    };

    updateItemLocal(id, { content: updatedContent });

    try {
      await moodboardService.updateItem(id, {
        content: updatedContent as unknown as Json,
      });
    } catch {
      // Handled
    }
  };

  // Bring item to front
  const bringToFront = async (id: string) => {
    const nextZ = getMaxZIndex() + 1;
    updateItemLocal(id, { z_index: nextZ });
    try {
      await moodboardService.updateItem(id, { zIndex: nextZ });
    } catch {
      // Handled
    }
  };

  // Delete item from moodboard (soft-delete with undo support)
  const deleteItem = async (id: string) => {
    const targetItem = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);

    if (targetItem) {
      recordUndoAction({ type: 'DELETE', itemId: id, item: targetItem });
    }

    try {
      await moodboardService.deleteItem(id);
    } catch {
      // Handled
    }
  };

  // Viewport Zoom & Pan Helpers
  const zoomIn = () => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 3),
    }));
  };

  const zoomOut = () => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, 0.2),
    }));
  };

  const resetViewport = () => {
    setViewport({ x: 0, y: 0, scale: 1 });
  };

  // Zoom to fit all canvas items
  const zoomToFit = useCallback(
    (containerWidth = 800, containerHeight = 600) => {
      if (items.length === 0) {
        setViewport({ x: 0, y: 0, scale: 1 });
        return;
      }
      const minX = Math.min(...items.map((i) => i.x));
      const minY = Math.min(...items.map((i) => i.y));
      const maxX = Math.max(...items.map((i) => i.x + i.width));
      const maxY = Math.max(...items.map((i) => i.y + i.height));

      const contentWidth = Math.max(maxX - minX, 100);
      const contentHeight = Math.max(maxY - minY, 100);
      const padding = 80;

      const scaleX = (containerWidth - padding * 2) / contentWidth;
      const scaleY = (containerHeight - padding * 2) / contentHeight;
      const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.25), 1.5);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const newX = containerWidth / 2 - centerX * newScale;
      const newY = containerHeight / 2 - centerY * newScale;

      setViewport({
        x: Math.round(newX),
        y: Math.round(newY),
        scale: Number(newScale.toFixed(2)),
      });
    },
    [items]
  );

  return {
    items,
    selectedId,
    setSelectedId,
    viewport,
    setViewport,
    isLoading,
    error,
    canUndo: !!lastAction,
    lastAction,
    recordUndoAction,
    undo,
    nudgeItem,
    zoomToFit,
    refetch: fetchItems,
    addReferenceItem,
    addImageItem,
    addTextNote,
    addColorItem,
    addIdeaItem,
    duplicateItem,
    updateItemLocal,
    persistItemGeometry,
    updateTextContent,
    updateColorContent,
    updateIdeaContent,
    bringToFront,
    deleteItem,
    zoomIn,
    zoomOut,
    resetViewport,
    screenToCanvasCoords,
  };
}
