'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { moodboardService } from '../services/moodboardService';
import type {
  MoodboardItem,
  MoodboardItemContent,
  CanvasViewport,
  TextItemContent,
  ImageItemContent,
  ColorItemContent,
  IdeaItemContent,
  ItemConnection,
  AnchorPosition,
  ResolvedConnection,
} from '../types';
import type { Json } from '@/types/database.types';
import type { Reference } from '@/features/references/types';
import { getImageNaturalDimensions } from '@/lib/utils/image';
import {
  calculateAlignment,
  calculateDistribution,
  calculateAutoArrange,
  type AlignmentType,
  type DistributionType,
} from '../utils/layoutUtils';
import { extractActiveConnections } from '../canvas/connectorUtils';

export type UndoAction =
  | {
      type: 'ADD' | 'DELETE' | 'MOVE' | 'RESIZE' | 'DUPLICATE';
      itemId: string;
      item?: MoodboardItem;
      prevGeometry?: { x: number; y: number; width: number; height: number; zIndex?: number };
      nextGeometry?: { x: number; y: number; width: number; height: number; zIndex?: number };
    }
  | {
      type: 'BATCH_MOVE';
      items: Array<{
        id: string;
        prevPosition: { x: number; y: number };
        nextPosition: { x: number; y: number };
      }>;
    }
  | {
      type: 'CONNECT_ITEMS';
      fromId: string;
      connection: ItemConnection;
    }
  | {
      type: 'DISCONNECT_ITEMS';
      fromId: string;
      connection: ItemConnection;
    }
  | {
      type: 'UPDATE_CONNECTION_LABEL';
      fromId: string;
      connectionId: string;
      prevLabel?: string;
      nextLabel?: string;
    };

export function useMoodboard(projectId: string, initialItems?: MoodboardItem[], readOnly?: boolean) {
  const [items, setItems] = useState<MoodboardItem[]>(initialItems || []);
  const [selectedIds, _setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null;

  const setSelectedIds = useCallback((nextOrUpdater: string[] | ((prev: string[]) => string[])) => {
    _setSelectedIds((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
      if (prev.length === next.length && prev.every((val, index) => val === next[index])) {
        return prev;
      }
      return next;
    });
  }, []);

  const setSelectedId = useCallback(
    (id: string | null) => {
      setSelectedIds((prev) => {
        if (id === null) return prev.length === 0 ? prev : [];
        if (prev.length === 1 && prev[0] === id) return prev;
        return [id];
      });
    },
    [setSelectedIds]
  );

  const toggleSelectedId = useCallback(
    (id: string, isMulti = false) => {
      setSelectedIds((prev) => {
        if (!isMulti) {
          return prev.includes(id) && prev.length === 1 ? [] : [id];
        }
        if (prev.includes(id)) {
          return prev.filter((i) => i !== id);
        }
        return [...prev, id];
      });
    },
    [setSelectedIds]
  );
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

  // Save status tracking for visible persistence feedback (no silent failures)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const activeSavesRef = useRef(0);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const beginSave = useCallback(() => {
    activeSavesRef.current += 1;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaveStatus('saving');
    setSaveError(null);
  }, []);

  const endSave = useCallback((err?: unknown) => {
    activeSavesRef.current = Math.max(0, activeSavesRef.current - 1);
    if (err) {
      console.error('Moodboard persistence error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save changes to moodboard';
      setSaveStatus('error');
      setSaveError(msg);
    } else if (activeSavesRef.current === 0) {
      setSaveStatus('saved');
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2500);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
      } else if (actionToRevert.type === 'BATCH_MOVE' && actionToRevert.items) {
        // Undo Batch Move / Auto Arrange -> restore all items' previous positions
        const revertMap = new Map(
          actionToRevert.items.map((i) => [i.id, i.prevPosition])
        );

        setItems((prev) =>
          prev.map((item) => {
            const prevPos = revertMap.get(item.id);
            if (!prevPos) return item;
            return {
              ...item,
              x: prevPos.x,
              y: prevPos.y,
            };
          })
        );

        for (const i of actionToRevert.items) {
          const itm = items.find((it) => it.id === i.id);
          if (itm) {
            await moodboardService.updateItem(i.id, {
              x: i.prevPosition.x,
              y: i.prevPosition.y,
              width: itm.width,
              height: itm.height,
              zIndex: itm.z_index,
            });
          }
        }
      } else if (actionToRevert.type === 'CONNECT_ITEMS') {
        // Undo Connect -> remove the connection from source item
        const fromItem = items.find((i) => i.id === actionToRevert.fromId);
        if (fromItem) {
          const rawConns = (fromItem.content as { connections?: ItemConnection[] })?.connections || [];
          const updatedConns = rawConns.filter((c) => c.id !== actionToRevert.connection.id);
          const updatedContent = { ...(fromItem.content as object), connections: updatedConns };
          setItems((prev) =>
            prev.map((i) => (i.id === actionToRevert.fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
          );
          await moodboardService.updateItem(actionToRevert.fromId, {
            content: updatedContent as unknown as Json,
          });
        }
      } else if (actionToRevert.type === 'DISCONNECT_ITEMS') {
        // Undo Disconnect -> restore the connection on source item
        const fromItem = items.find((i) => i.id === actionToRevert.fromId);
        if (fromItem) {
          const rawConns = (fromItem.content as { connections?: ItemConnection[] })?.connections || [];
          const updatedConns = [...rawConns, actionToRevert.connection];
          const updatedContent = { ...(fromItem.content as object), connections: updatedConns };
          setItems((prev) =>
            prev.map((i) => (i.id === actionToRevert.fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
          );
          await moodboardService.updateItem(actionToRevert.fromId, {
            content: updatedContent as unknown as Json,
          });
        }
      } else if (actionToRevert.type === 'UPDATE_CONNECTION_LABEL') {
        // Undo Label Edit -> revert label
        const fromItem = items.find((i) => i.id === actionToRevert.fromId);
        if (fromItem) {
          const rawConns = (fromItem.content as { connections?: ItemConnection[] })?.connections || [];
          const updatedConns = rawConns.map((c) =>
            c.id === actionToRevert.connectionId ? { ...c, label: actionToRevert.prevLabel } : c
          );
          const updatedContent = { ...(fromItem.content as object), connections: updatedConns };
          setItems((prev) =>
            prev.map((i) => (i.id === actionToRevert.fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
          );
          await moodboardService.updateItem(actionToRevert.fromId, {
            content: updatedContent as unknown as Json,
          });
        }
      }
    } catch (err) {
      console.error('Failed to execute undo:', err);
    }
  }, [lastAction, selectedId, setSelectedId, items]);

  // Add reference item to canvas
  const addReferenceItem = async (
    reference: Reference,
    canvasPosition?: { x: number; y: number }
  ): Promise<MoodboardItem> => {
    const nextZ = getMaxZIndex() + 1;

    let itemWidth = 300;
    let itemHeight = 220;

    if (reference.thumbnail_url) {
      const dims = await getImageNaturalDimensions(reference.thumbnail_url);
      if (dims && dims.width > 0 && dims.height > 0) {
        const aspect = dims.height / dims.width;
        itemWidth = 300;
        itemHeight = Math.round(itemWidth * aspect);

        // Clamp bounds while strictly preserving natural aspect ratio
        const maxHeight = 400;
        const minHeight = 120;
        if (itemHeight > maxHeight) {
          itemHeight = maxHeight;
          itemWidth = Math.round(itemHeight / aspect);
        } else if (itemHeight < minHeight) {
          itemHeight = minHeight;
          itemWidth = Math.round(itemHeight / aspect);
        }
      }
    }

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
      width: itemWidth,
      height: itemHeight,
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

    const aspectRatio = naturalHeight > 0 && naturalWidth > 0 ? naturalHeight / naturalWidth : 0.75;
    let targetWidth = 300;
    let targetHeight = Math.round(targetWidth * aspectRatio);

    // Clamp bounds while strictly preserving natural aspect ratio
    const maxHeight = 400;
    const minHeight = 120;
    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = Math.round(targetHeight / aspectRatio);
    } else if (targetHeight < minHeight) {
      targetHeight = minHeight;
      targetWidth = Math.round(targetHeight / aspectRatio);
    }

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
        beginSave();
        try {
          await moodboardService.updateItem(id, geometry);
          endSave();
        } catch (err) {
          endSave(err);
        } finally {
          pendingUpdatesRef.current.delete(id);
        }
      }, 250);

      pendingUpdatesRef.current.set(id, timer);
    },
    [beginSave, endSave]
  );

  // Adjust item dimensions to natural aspect ratio (e.g. legacy items) without polluting undo history
  const correctItemDimensions = useCallback(
    (id: string, width: number, height: number) => {
      updateItemLocal(id, { width, height });
      const item = items.find((i) => i.id === id);
      if (item) {
        persistItemGeometry(id, {
          x: item.x,
          y: item.y,
          width,
          height,
          zIndex: item.z_index,
        });
      }
    },
    [items, updateItemLocal, persistItemGeometry]
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

    beginSave();
    try {
      await moodboardService.updateItem(id, {
        content: updatedContent as unknown as Json,
      });
      endSave();
    } catch (err) {
      endSave(err);
    }
  };

  // Update color swatch content
  const updateColorContent = async (id: string, hex: string, label?: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.type !== 'color') return;

    const updatedContent: ColorItemContent = {
      ...(item.content as ColorItemContent),
      hex: hex.toUpperCase(),
      label: label || hex.toUpperCase(),
    };

    updateItemLocal(id, { content: updatedContent });

    beginSave();
    try {
      await moodboardService.updateItem(id, {
        content: updatedContent as unknown as Json,
      });
      endSave();
    } catch (err) {
      endSave(err);
    }
  };

  // Update creative idea content
  const updateIdeaContent = async (id: string, title: string, notes?: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.type !== 'idea') return;

    const updatedContent: IdeaItemContent = {
      ...(item.content as IdeaItemContent),
      title,
      notes: notes !== undefined ? notes : (item.content as IdeaItemContent).notes,
    };

    updateItemLocal(id, { content: updatedContent });

    beginSave();
    try {
      await moodboardService.updateItem(id, {
        content: updatedContent as unknown as Json,
      });
      endSave();
    } catch (err) {
      endSave(err);
    }
  };

  // Bring item to front
  const bringToFront = async (id: string) => {
    const nextZ = getMaxZIndex() + 1;
    updateItemLocal(id, { z_index: nextZ });
    beginSave();
    try {
      await moodboardService.updateItem(id, { zIndex: nextZ });
      endSave();
    } catch (err) {
      endSave(err);
    }
  };

  // Delete item from moodboard (soft-delete with undo support)
  const deleteItem = async (id: string) => {
    const targetItem = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));

    if (targetItem) {
      recordUndoAction({ type: 'DELETE', itemId: id, item: targetItem });
    }

    beginSave();
    try {
      await moodboardService.deleteItem(id);
      endSave();
    } catch (err) {
      endSave(err);
    }
  };

  // Bulk delete all selected items
  const deleteSelectedItems = async () => {
    if (selectedIds.length === 0) return;
    const idsToDelete = [...selectedIds];
    const targets = items.filter((i) => idsToDelete.includes(i.id));

    setItems((prev) => prev.filter((item) => !idsToDelete.includes(item.id)));
    setSelectedIds([]);

    beginSave();
    try {
      for (const target of targets) {
        recordUndoAction({ type: 'DELETE', itemId: target.id, item: target });
        await moodboardService.deleteItem(target.id);
      }
      endSave();
    } catch (err) {
      endSave(err);
    }
  };

  // Bulk duplicate all selected items
  const duplicateSelectedItems = async (): Promise<MoodboardItem[]> => {
    if (selectedIds.length === 0) return [];
    const duplicated: MoodboardItem[] = [];
    const newSelectedIds: string[] = [];

    beginSave();
    try {
      for (const id of selectedIds) {
        const source = items.find((i) => i.id === id);
        if (!source) continue;

        const nextZ = getMaxZIndex() + 1;
        const created = await moodboardService.createItem({
          projectId,
          referenceId: source.reference_id,
          type: source.type,
          content: source.content as unknown as Json,
          x: source.x + 30,
          y: source.y + 30,
          width: source.width,
          height: source.height,
          zIndex: nextZ,
        });

        const itemWithRef: MoodboardItem = {
          ...created,
          reference: source.reference,
        };
        duplicated.push(itemWithRef);
        newSelectedIds.push(created.id);
        recordUndoAction({ type: 'DUPLICATE', itemId: created.id, item: itemWithRef });
      }

      if (duplicated.length > 0) {
        setItems((prev) => [...prev, ...duplicated]);
        setSelectedIds(newSelectedIds);
      }
      endSave();
      return duplicated;
    } catch (err) {
      endSave(err);
      return [];
    }
  };

  // Bulk nudge all selected items
  const nudgeSelectedItems = useCallback((dx: number, dy: number) => {
    if (selectedIds.length === 0) return;
    setItems((prev) =>
      prev.map((item) => {
        if (!selectedIds.includes(item.id)) return item;
        const newX = Math.round(item.x + dx);
        const newY = Math.round(item.y + dy);
        persistItemGeometry(item.id, {
          x: newX,
          y: newY,
          width: item.width,
          height: item.height,
        });
        return {
          ...item,
          x: newX,
          y: newY,
        };
      })
    );
  }, [selectedIds, persistItemGeometry]);

  // Batch move items with single undo step (used by Align, Distribute, Auto-Arrange)
  const batchMoveItems = useCallback(
    (updates: Array<{ id: string; x: number; y: number }>) => {
      if (updates.length === 0) return;

      const undoItems: Array<{
        id: string;
        prevPosition: { x: number; y: number };
        nextPosition: { x: number; y: number };
      }> = [];

      const updateMap = new Map(updates.map((u) => [u.id, { x: u.x, y: u.y }]));

      setItems((prev) =>
        prev.map((item) => {
          const nextPos = updateMap.get(item.id);
          if (!nextPos) return item;
          undoItems.push({
            id: item.id,
            prevPosition: { x: item.x, y: item.y },
            nextPosition: { x: nextPos.x, y: nextPos.y },
          });
          return {
            ...item,
            x: nextPos.x,
            y: nextPos.y,
          };
        })
      );

      if (undoItems.length > 0) {
        recordUndoAction({
          type: 'BATCH_MOVE',
          items: undoItems,
        });

        for (const update of updates) {
          const itm = items.find((i) => i.id === update.id);
          if (itm) {
            persistItemGeometry(update.id, {
              x: update.x,
              y: update.y,
              width: itm.width,
              height: itm.height,
              zIndex: itm.z_index,
            });
          }
        }
      }
    },
    [items, persistItemGeometry, recordUndoAction]
  );

  // Align selected items (Left, Center-H, Right, Top, Center-V, Bottom)
  const alignSelectedItems = useCallback(
    (alignment: AlignmentType) => {
      const activeIds = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : []);
      if (activeIds.length < 2) return;
      const updates = calculateAlignment(items, activeIds, alignment);
      batchMoveItems(updates);
    },
    [items, selectedIds, selectedId, batchMoveItems]
  );

  // Distribute selected items (Horizontal or Vertical)
  const distributeSelectedItems = useCallback(
    (direction: DistributionType) => {
      const activeIds = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : []);
      if (activeIds.length < 3) return;
      const updates = calculateDistribution(items, activeIds, direction);
      batchMoveItems(updates);
    },
    [items, selectedIds, selectedId, batchMoveItems]
  );

  // Auto-arrange items into an organized grid
  const autoArrange = useCallback(() => {
    const activeIds = selectedIds.length > 1 ? selectedIds : undefined;
    const updates = calculateAutoArrange(items, activeIds);
    batchMoveItems(updates);
  }, [items, selectedIds, batchMoveItems]);

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

  // Selected Connection Arrow State
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Resolved flat list of all active connections on the board
  const connections: ResolvedConnection[] = useMemo(() => {
    return extractActiveConnections(items);
  }, [items]);

  // Add connection from one item to another
  const addConnection = useCallback(
    async (
      fromId: string,
      targetId: string,
      fromAnchor?: AnchorPosition,
      toAnchor?: AnchorPosition,
      label?: string
    ): Promise<ItemConnection | null> => {
      if (fromId === targetId) return null;
      const source = items.find((i) => i.id === fromId);
      const target = items.find((i) => i.id === targetId);
      if (!source || !target) return null;

      const newConnection: ItemConnection = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        targetId,
        fromAnchor,
        toAnchor,
        label: label?.trim() || undefined,
      };

      const existingConnections = (source.content as { connections?: ItemConnection[] })?.connections || [];
      // Prevent duplicate connection between exact same endpoints
      if (existingConnections.some((c) => c.targetId === targetId && c.fromAnchor === fromAnchor && c.toAnchor === toAnchor)) {
        return null;
      }

      const updatedConnections = [...existingConnections, newConnection];
      const updatedContent = {
        ...(source.content as object),
        connections: updatedConnections,
      };

      setItems((prev) =>
        prev.map((i) => (i.id === fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
      );

      recordUndoAction({
        type: 'CONNECT_ITEMS',
        fromId,
        connection: newConnection,
      });

      beginSave();
      try {
        await moodboardService.updateItem(fromId, {
          content: updatedContent as unknown as Json,
        });
        endSave();
      } catch (err) {
        endSave(err);
      }

      return newConnection;
    },
    [items, recordUndoAction, beginSave, endSave]
  );

  // Remove connection by its ID
  const removeConnection = useCallback(
    async (connectionId: string) => {
      let sourceItem: MoodboardItem | undefined;
      let removedConnection: ItemConnection | undefined;

      for (const item of items) {
        const conns = (item.content as { connections?: ItemConnection[] })?.connections;
        const found = conns?.find((c) => c.id === connectionId);
        if (found) {
          sourceItem = item;
          removedConnection = found;
          break;
        }
      }

      if (!sourceItem || !removedConnection) return;

      const fromId = sourceItem.id;
      const existingConnections = (sourceItem.content as { connections?: ItemConnection[] })?.connections || [];
      const updatedConnections = existingConnections.filter((c) => c.id !== connectionId);
      const updatedContent = {
        ...(sourceItem.content as object),
        connections: updatedConnections,
      };

      setItems((prev) =>
        prev.map((i) => (i.id === fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
      );

      setSelectedConnectionId((prev) => (prev === connectionId ? null : prev));

      recordUndoAction({
        type: 'DISCONNECT_ITEMS',
        fromId,
        connection: removedConnection,
      });

      beginSave();
      try {
        await moodboardService.updateItem(fromId, {
          content: updatedContent as unknown as Json,
        });
        endSave();
      } catch (err) {
        endSave(err);
      }
    },
    [items, recordUndoAction, beginSave, endSave]
  );

  // Update connection label
  const updateConnectionLabel = useCallback(
    async (connectionId: string, label: string) => {
      let sourceItem: MoodboardItem | undefined;
      let targetConnection: ItemConnection | undefined;

      for (const item of items) {
        const conns = (item.content as { connections?: ItemConnection[] })?.connections;
        const found = conns?.find((c) => c.id === connectionId);
        if (found) {
          sourceItem = item;
          targetConnection = found;
          break;
        }
      }

      if (!sourceItem || !targetConnection) return;

      const fromId = sourceItem.id;
      const prevLabel = targetConnection.label;
      const nextLabel = label.trim() || undefined;

      const existingConnections = (sourceItem.content as { connections?: ItemConnection[] })?.connections || [];
      const updatedConnections = existingConnections.map((c) =>
        c.id === connectionId ? { ...c, label: nextLabel } : c
      );
      const updatedContent = {
        ...(sourceItem.content as object),
        connections: updatedConnections,
      };

      setItems((prev) =>
        prev.map((i) => (i.id === fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
      );

      recordUndoAction({
        type: 'UPDATE_CONNECTION_LABEL',
        fromId,
        connectionId,
        prevLabel,
        nextLabel,
      });

      beginSave();
      try {
        await moodboardService.updateItem(fromId, {
          content: updatedContent as unknown as Json,
        });
        endSave();
      } catch (err) {
        endSave(err);
      }
    },
    [items, recordUndoAction, beginSave, endSave]
  );

  // Helper to get all reference IDs connected to an item (used for Idea -> Direction promotion)
  const getConnectedReferenceIds = useCallback(
    (itemId: string): string[] => {
      const activeConns = extractActiveConnections(items);
      const connectedItemIds = new Set<string>();

      for (const conn of activeConns) {
        if (conn.fromId === itemId) {
          connectedItemIds.add(conn.targetId);
        } else if (conn.targetId === itemId) {
          connectedItemIds.add(conn.fromId);
        }
      }

      const referenceIds: string[] = [];
      for (const id of connectedItemIds) {
        const itm = items.find((i) => i.id === id);
        if (itm && itm.type === 'reference' && itm.reference_id) {
          referenceIds.push(itm.reference_id);
        }
      }
      return referenceIds;
    },
    [items]
  );

  return {
    items,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    toggleSelectedId,
    viewport,
    setViewport,
    isLoading,
    error,
    saveStatus,
    saveError,
    clearSaveError: () => setSaveError(null),
    canUndo: !!lastAction,
    lastAction,
    recordUndoAction,
    undo,
    nudgeItem,
    nudgeSelectedItems,
    alignSelectedItems,
    distributeSelectedItems,
    autoArrange,
    zoomToFit,
    refetch: fetchItems,
    addReferenceItem,
    addImageItem,
    addTextNote,
    addColorItem,
    addIdeaItem,
    duplicateItem,
    duplicateSelectedItems,
    updateItemLocal,
    correctItemDimensions,
    persistItemGeometry,
    updateTextContent,
    updateColorContent,
    updateIdeaContent,
    bringToFront,
    deleteItem,
    deleteSelectedItems,
    zoomIn,
    zoomOut,
    resetViewport,
    screenToCanvasCoords,
    connections,
    selectedConnectionId,
    setSelectedConnectionId,
    addConnection,
    removeConnection,
    updateConnectionLabel,
    getConnectedReferenceIds,
  };
}
