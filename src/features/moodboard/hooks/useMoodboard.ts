'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { pushToStack, popFromStack, reconcileStack } from './historyStack';
import { moodboardService } from '../services/moodboardService';
import type {
  MoodboardItem,
  MoodboardItemContent,
  CanvasViewport,
  TextItemContent,
  ImageItemContent,
  ColorItemContent,
  IdeaItemContent,
  StrokeItemContent,
  ItemConnection,
  AnchorPosition,
  ResolvedConnection,
} from '../types';
import type { Json } from '@/types/database.types';
import type { Reference } from '@/features/references/types';
import { getImageNaturalDimensions } from '@/lib/utils/image';
import { getCanvasSafeImageUrl } from '../utils/canvasImageUtils';
import {
  calculateAlignment,
  calculateDistribution,
  calculateAutoArrange,
  type AlignmentType,
  type DistributionType,
} from '../utils/layoutUtils';
import { extractActiveConnections } from '../connectors/connectionResolution';
import { getConnectedReferenceIdsForIdea } from '../connectors/semanticDirection';
import { calculateZoomToFit } from '../coordinates';

export type UndoAction =
  | {
      type: 'ADD' | 'DELETE' | 'MOVE' | 'RESIZE' | 'DUPLICATE';
      itemId: string;
      item?: MoodboardItem;
      prevGeometry?: { x: number; y: number; width: number; height: number; zIndex?: number };
      nextGeometry?: { x: number; y: number; width: number; height: number; zIndex?: number };
    }
  | {
      type: 'BATCH_DELETE';
      items: MoodboardItem[];
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
      type: 'PARTIAL_ERASE';
      originalStrokes: MoodboardItem[];
      /** Full optimistic items — needed to restore them on redo after undo soft-deleted them. */
      createdItems: MoodboardItem[];
      createdItemIds: string[];
      updatedItems: Array<{
        id: string;
        prevItem: MoodboardItem;
        /** Post-erase geometry — needed to reapply on redo. */
        nextX: number;
        nextY: number;
        nextWidth: number;
        nextHeight: number;
        nextRelativePoints: number[];
      }>;
      deletedItemIds: string[];
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
  const normalizeItem = useCallback((item: any): MoodboardItem => {
    const content = (item.content as any) || {};
    const isStroke =
      item.type === 'stroke' ||
      (item.type === 'idea' && content.strokeType === 'stroke') ||
      Array.isArray(content.points);
    return {
      ...item,
      type: isStroke ? 'stroke' : item.type,
    };
  }, []);

  const [items, setItems] = useState<MoodboardItem[]>(() =>
    initialItems ? initialItems.map(normalizeItem) : []
  );
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
      setItems(initialItems.map(normalizeItem));
      setIsLoading(false);
    }
  }, [initialItems, normalizeItem]);

  // Multi-step undo/redo history stacks (refs for O(1) mutation; boolean state for reactive UI)
  const undoStackRef = useRef<UndoAction[]>([]);
  const redoStackRef = useRef<UndoAction[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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
  // Keep track of pending merged geometries for each item to prevent stale overwrites
  const pendingGeometriesRef = useRef<Map<string, { x?: number; y?: number; width?: number; height?: number; zIndex?: number }>>(new Map());

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

  // Push an action onto the undo stack, clear redo branch, enforce depth limit
  const recordUndoAction = useCallback((action: UndoAction) => {
    undoStackRef.current = pushToStack(undoStackRef.current, action);
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Reconcile temporary IDs (temp-stroke-..., temp-erase-...) across both history stacks.
  // Must be called after any optimistic DB write resolves with a real UUID.
  // The reconcileAction function is kept inline to avoid a circular dependency with historyStack.ts.
  const reconcileHistoryIds = useCallback((oldToNew: Map<string, MoodboardItem>) => {
    const reconcileAction = (action: UndoAction): UndoAction => {
      if (
        (action.type === 'ADD' || action.type === 'DUPLICATE') &&
        oldToNew.has(action.itemId)
      ) {
        const real = oldToNew.get(action.itemId)!;
        return { ...action, itemId: real.id, item: real };
      }
      if (action.type === 'PARTIAL_ERASE') {
        const needsReconcile = action.createdItemIds.some((id) => oldToNew.has(id));
        if (!needsReconcile) return action;
        return {
          ...action,
          createdItemIds: action.createdItemIds.map((id) =>
            oldToNew.has(id) ? oldToNew.get(id)!.id : id
          ),
          createdItems: action.createdItems.map((item) => {
            const real = oldToNew.get(item.id);
            if (!real) return item;
            return { ...real, content: item.content };
          }),
        };
      }
      return action;
    };
    undoStackRef.current = reconcileStack(undoStackRef.current, reconcileAction);
    redoStackRef.current = reconcileStack(redoStackRef.current, reconcileAction);
  }, []);

  // Multi-step Undo — reverts the most recent action
  const undo = useCallback(async () => {
    const { action: actionToRevert, remaining } = popFromStack(undoStackRef.current);
    if (!actionToRevert) return;

    undoStackRef.current = remaining;
    redoStackRef.current = pushToStack(redoStackRef.current, actionToRevert);
    setCanUndo(remaining.length > 0);
    setCanRedo(true);

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
      } else if (actionToRevert.type === 'BATCH_DELETE' && actionToRevert.items) {
        // Undo Batch Delete -> restore all items in parallel
        await Promise.all(actionToRevert.items.map((i) => moodboardService.restoreItem(i.id)));
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const toAdd = actionToRevert.items.filter((i) => !existingIds.has(i.id));
          return [...prev, ...toAdd];
        });
        setSelectedIds(actionToRevert.items.map((i) => i.id));
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
            return { ...item, x: prevPos.x, y: prevPos.y };
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
        }
      } else if (actionToRevert.type === 'PARTIAL_ERASE') {
        // Undo Partial Erase:
        // 1. Soft-delete created split sub-strokes
        if (actionToRevert.createdItemIds.length > 0) {
          await Promise.all(
            actionToRevert.createdItemIds.map((id) => {
              if (id.startsWith('temp-')) return Promise.resolve();
              return moodboardService.softDeleteItem(id);
            })
          );
        }
        // 2. Restore originally erased strokes
        if (actionToRevert.deletedItemIds.length > 0) {
          await Promise.all(actionToRevert.deletedItemIds.map((id) => moodboardService.restoreItem(id)));
        }
        // 3. Restore updated strokes to their pre-erase state
        if (actionToRevert.updatedItems.length > 0) {
          await Promise.all(
            actionToRevert.updatedItems.map((u) =>
              moodboardService.updateItem(u.id, {
                x: u.prevItem.x,
                y: u.prevItem.y,
                width: u.prevItem.width,
                height: u.prevItem.height,
                content: u.prevItem.content as unknown as Json,
              })
            )
          );
        }
        // 4. Update React state: remove created, restore originalStrokes
        setItems((prev) => {
          const createdSet = new Set(actionToRevert.createdItemIds);
          const origMap = new Map(actionToRevert.originalStrokes.map((s) => [s.id, s]));
          const withoutCreated = prev.filter((i) => !createdSet.has(i.id));
          const reverted = withoutCreated.map((i) => origMap.get(i.id) ?? i);
          for (const orig of actionToRevert.originalStrokes) {
            if (!reverted.some((i) => i.id === orig.id)) {
              reverted.push(orig);
            }
          }
          return reverted;
        });
      }
    } catch (err) {
      console.error('Failed to execute undo:', err);
    }
  }, [selectedId, setSelectedId, setSelectedIds, items]);

  // Multi-step Redo — reapplies the most recently undone action
  const redo = useCallback(async () => {
    const { action: actionToRedo, remaining } = popFromStack(redoStackRef.current);
    if (!actionToRedo) return;

    redoStackRef.current = remaining;
    undoStackRef.current = pushToStack(undoStackRef.current, actionToRedo);
    setCanRedo(remaining.length > 0);
    setCanUndo(true);

    try {
      if (actionToRedo.type === 'ADD' || actionToRedo.type === 'DUPLICATE') {
        // Redo Add/Duplicate -> restore the soft-deleted item
        setItems((prev) => {
          if (prev.some((i) => i.id === actionToRedo.itemId)) return prev;
          return [...prev, actionToRedo.item!];
        });
        setSelectedId(actionToRedo.itemId);
        await moodboardService.restoreItem(actionToRedo.itemId);
      } else if (actionToRedo.type === 'DELETE') {
        // Redo Delete -> soft-delete again
        setItems((prev) => prev.filter((i) => i.id !== actionToRedo.itemId));
        if (selectedId === actionToRedo.itemId) setSelectedId(null);
        await moodboardService.softDeleteItem(actionToRedo.itemId);
      } else if (actionToRedo.type === 'BATCH_DELETE') {
        // Redo Batch Delete -> soft-delete all again
        const ids = new Set(actionToRedo.items.map((i) => i.id));
        setItems((prev) => prev.filter((i) => !ids.has(i.id)));
        setSelectedIds((prev) => prev.filter((id) => !ids.has(id)));
        await Promise.all(actionToRedo.items.map((i) => moodboardService.softDeleteItem(i.id)));
      } else if (
        (actionToRedo.type === 'MOVE' || actionToRedo.type === 'RESIZE') &&
        actionToRedo.nextGeometry
      ) {
        // Redo Move/Resize -> restore next geometry
        const nextGeo = actionToRedo.nextGeometry;
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== actionToRedo.itemId) return i;
            return {
              ...i,
              x: nextGeo.x,
              y: nextGeo.y,
              width: nextGeo.width,
              height: nextGeo.height,
              z_index: nextGeo.zIndex ?? i.z_index,
            };
          })
        );
        await moodboardService.updateItem(actionToRedo.itemId, {
          x: nextGeo.x,
          y: nextGeo.y,
          width: nextGeo.width,
          height: nextGeo.height,
          zIndex: nextGeo.zIndex,
        });
      } else if (actionToRedo.type === 'BATCH_MOVE') {
        // Redo Batch Move -> restore next positions
        const nextMap = new Map(
          actionToRedo.items.map((i) => [i.id, i.nextPosition])
        );
        setItems((prev) =>
          prev.map((item) => {
            const nextPos = nextMap.get(item.id);
            if (!nextPos) return item;
            return { ...item, x: nextPos.x, y: nextPos.y };
          })
        );
        for (const i of actionToRedo.items) {
          const itm = items.find((it) => it.id === i.id);
          if (itm) {
            await moodboardService.updateItem(i.id, {
              x: i.nextPosition.x,
              y: i.nextPosition.y,
              width: itm.width,
              height: itm.height,
              zIndex: itm.z_index,
            });
          }
        }
      } else if (actionToRedo.type === 'CONNECT_ITEMS') {
        // Redo Connect -> re-add the connection
        const fromItem = items.find((i) => i.id === actionToRedo.fromId);
        if (fromItem) {
          const rawConns = (fromItem.content as { connections?: ItemConnection[] })?.connections || [];
          if (!rawConns.some((c) => c.id === actionToRedo.connection.id)) {
            const updatedConns = [...rawConns, actionToRedo.connection];
            const updatedContent = { ...(fromItem.content as object), connections: updatedConns };
            setItems((prev) =>
              prev.map((i) => (i.id === actionToRedo.fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
            );
            await moodboardService.updateItem(actionToRedo.fromId, {
              content: updatedContent as unknown as Json,
            });
          }
        }
      } else if (actionToRedo.type === 'DISCONNECT_ITEMS') {
        // Redo Disconnect -> remove the connection again
        const fromItem = items.find((i) => i.id === actionToRedo.fromId);
        if (fromItem) {
          const rawConns = (fromItem.content as { connections?: ItemConnection[] })?.connections || [];
          const updatedConns = rawConns.filter((c) => c.id !== actionToRedo.connection.id);
          const updatedContent = { ...(fromItem.content as object), connections: updatedConns };
          setItems((prev) =>
            prev.map((i) => (i.id === actionToRedo.fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
          );
          await moodboardService.updateItem(actionToRedo.fromId, {
            content: updatedContent as unknown as Json,
          });
        }
      } else if (actionToRedo.type === 'UPDATE_CONNECTION_LABEL') {
        // Redo Label Edit -> apply next label
        const fromItem = items.find((i) => i.id === actionToRedo.fromId);
        if (fromItem) {
          const rawConns = (fromItem.content as { connections?: ItemConnection[] })?.connections || [];
          const updatedConns = rawConns.map((c) =>
            c.id === actionToRedo.connectionId ? { ...c, label: actionToRedo.nextLabel } : c
          );
          const updatedContent = { ...(fromItem.content as object), connections: updatedConns };
          setItems((prev) =>
            prev.map((i) => (i.id === actionToRedo.fromId ? { ...i, content: updatedContent as unknown as MoodboardItemContent } : i))
          );
          await moodboardService.updateItem(actionToRedo.fromId, {
            content: updatedContent as unknown as Json,
          });
        }
      } else if (actionToRedo.type === 'PARTIAL_ERASE') {
        // Redo Partial Erase:
        // 1. Re-soft-delete the originally erased strokes
        if (actionToRedo.deletedItemIds.length > 0) {
          await Promise.all(
            actionToRedo.deletedItemIds.map((id) => moodboardService.softDeleteItem(id))
          );
        }
        // 2. Restore the created split sub-strokes (soft-deleted by undo)
        if (actionToRedo.createdItemIds.length > 0) {
          await Promise.all(
            actionToRedo.createdItemIds.map((id) => {
              if (id.startsWith('temp-')) return Promise.resolve();
              return moodboardService.restoreItem(id);
            })
          );
        }
        // 3. Re-apply post-erase geometry to updated strokes
        if (actionToRedo.updatedItems.length > 0) {
          await Promise.all(
            actionToRedo.updatedItems.map((u) => {
              const origContent = (u.prevItem.content as StrokeItemContent) || {};
              const nextContent: StrokeItemContent = { ...origContent, points: u.nextRelativePoints };
              return moodboardService.updateItem(u.id, {
                x: u.nextX,
                y: u.nextY,
                width: u.nextWidth,
                height: u.nextHeight,
                content: nextContent as unknown as Json,
              });
            })
          );
        }
        // 4. Update React state
        setItems((prev) => {
          const deletedSet = new Set(actionToRedo.deletedItemIds);
          const updateMap = new Map(actionToRedo.updatedItems.map((u) => [u.id, u]));
          // Remove originally deleted strokes
          const withoutDeleted = prev.filter((i) => !deletedSet.has(i.id));
          // Re-apply next geometry to updated strokes
          const withUpdates = withoutDeleted.map((item) => {
            const u = updateMap.get(item.id);
            if (!u) return item;
            const origContent = (item.content as StrokeItemContent) || {};
            return {
              ...item,
              x: u.nextX,
              y: u.nextY,
              width: u.nextWidth,
              height: u.nextHeight,
              content: { ...origContent, points: u.nextRelativePoints } as unknown as MoodboardItemContent,
            };
          });
          // Re-add created sub-strokes if they were removed by undo
          const existingIds = new Set(withUpdates.map((i) => i.id));
          const toAdd = actionToRedo.createdItems.filter((i) => !existingIds.has(i.id));
          return [...withUpdates, ...toAdd];
        });
      }
    } catch (err) {
      console.error('Failed to execute redo:', err);
    }
  }, [selectedId, setSelectedId, setSelectedIds, items]);

  // Add reference item to canvas
  const addReferenceItem = async (
    reference: Reference,
    canvasPosition?: { x: number; y: number }
  ): Promise<MoodboardItem> => {
    const nextZ = getMaxZIndex() + 1;

    let itemWidth = 300;
    let itemHeight = 220;

    if (reference.thumbnail_url) {
      const probeUrl = getCanvasSafeImageUrl(reference.thumbnail_url);
      const dims = await getImageNaturalDimensions(probeUrl);
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

  // Add freehand drawing stroke to canvas
  const addStrokeItem = async (
    points: number[],
    color: string,
    strokeWidth: number,
    bbox: { x: number; y: number; width: number; height: number }
  ): Promise<MoodboardItem> => {
    const nextZ = getMaxZIndex() + 1;
    const content: StrokeItemContent = {
      points,
      color,
      strokeWidth,
      tension: 0.5,
    };

    // 1. Create and render optimistic stroke item synchronously on mouseup
    const tempId = `temp-stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimisticItem: MoodboardItem = {
      id: tempId,
      project_id: projectId,
      reference_id: null,
      type: 'stroke',
      content: content as unknown as MoodboardItemContent,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      z_index: nextZ,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    setItems((prev) => [...prev, optimisticItem]);

    // 2. Persist to database in the background without blocking the UI
    beginSave();
    try {
      const created = await moodboardService.createItem({
        projectId,
        referenceId: null,
        type: 'stroke',
        content: content as unknown as Json,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
        zIndex: nextZ,
      });

      // Reconcile optimistic ID with the real DB ID
      setItems((prev) =>
        prev.map((i) => (i.id === tempId ? { ...created, content: i.content } : i))
      );
      recordUndoAction({ type: 'ADD', itemId: created.id, item: created });
      endSave();
      return created;
    } catch (err) {
      // Rollback optimistic item on failure
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      endSave(err);
      throw err;
    }
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

  // Persist item position/size to Supabase with partial geometry merging
  const persistItemGeometry = useCallback(
    (
      id: string,
      geometry: { x?: number; y?: number; width?: number; height?: number; zIndex?: number }
    ) => {
      const existingTimer = pendingUpdatesRef.current.get(id);
      if (existingTimer) clearTimeout(existingTimer);

      const merged = {
        ...(pendingGeometriesRef.current.get(id) || {}),
        ...geometry,
      };
      pendingGeometriesRef.current.set(id, merged);

      const timer = setTimeout(async () => {
        const toSave = pendingGeometriesRef.current.get(id);
        pendingGeometriesRef.current.delete(id);
        pendingUpdatesRef.current.delete(id);
        if (!toSave) return;

        beginSave();
        try {
          await moodboardService.updateItem(id, toSave);
          endSave();
        } catch (err) {
          endSave(err);
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
    persistItemGeometry(id, { zIndex: nextZ });
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

  // Batch delete items with single-step batch undo support (used by bulk delete and whole-stroke eraser)
  const batchDeleteItems = useCallback(
    async (itemsToDelete: MoodboardItem[] | string[]) => {
      if (itemsToDelete.length === 0) return;

      const ids = typeof itemsToDelete[0] === 'string'
        ? (itemsToDelete as string[])
        : (itemsToDelete as MoodboardItem[]).map((i) => i.id);

      const targets = typeof itemsToDelete[0] === 'string'
        ? items.filter((i) => ids.includes(i.id))
        : (itemsToDelete as MoodboardItem[]);

      if (targets.length === 0) return;

      setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));

      recordUndoAction({
        type: 'BATCH_DELETE',
        items: targets,
      });

      beginSave();
      try {
        await Promise.all(targets.map((t) => moodboardService.softDeleteItem(t.id)));
        endSave();
      } catch (err) {
        endSave(err);
      }
    },
    [items, recordUndoAction, beginSave, endSave, setSelectedIds]
  );

  // Commit partial stroke erasing (updates, splits, and deletions) with 1-step atomic undo
  const commitPartialErase = useCallback(
    async (
      updates: Array<{ id: string; x: number; y: number; width: number; height: number; relativePoints: number[] }>,
      newStrokes: Array<{
        referenceId?: string | null;
        content: StrokeItemContent;
        x: number;
        y: number;
        width: number;
        height: number;
        zIndex: number;
      }>,
      deletedIds: string[],
      originalStrokes: MoodboardItem[]
    ) => {
      if (updates.length === 0 && newStrokes.length === 0 && deletedIds.length === 0) {
        return;
      }

      const deletedSet = new Set(deletedIds);
      const updateMap = new Map(updates.map((u) => [u.id, u]));

      // 1. Generate optimistic items for new split sub-strokes
      const optimisticCreated: MoodboardItem[] = newStrokes.map((stroke, index) => ({
        id: `temp-erase-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        project_id: projectId,
        reference_id: stroke.referenceId || null,
        type: 'stroke',
        content: stroke.content as unknown as MoodboardItemContent,
        x: stroke.x,
        y: stroke.y,
        width: stroke.width,
        height: stroke.height,
        z_index: stroke.zIndex,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      }));

      // 2. Synchronously update local React state — zero visual blank gap on mouseup
      setItems((prev) => {
        const withoutDeleted = prev.filter((i) => !deletedSet.has(i.id));
        const withUpdates = withoutDeleted.map((i) => {
          const u = updateMap.get(i.id);
          if (!u) return i;
          const origContent = (i.content as StrokeItemContent) || {};
          return {
            ...i,
            x: u.x,
            y: u.y,
            width: u.width,
            height: u.height,
            content: {
              ...origContent,
              points: u.relativePoints,
            },
          };
        });
        return [...withUpdates, ...optimisticCreated];
      });

      // 3. Record single atomic undo action immediately (with full redo-safe payload)
      recordUndoAction({
        type: 'PARTIAL_ERASE',
        originalStrokes,
        createdItems: optimisticCreated,
        createdItemIds: optimisticCreated.map((i) => i.id),
        updatedItems: updates.map((u) => ({
          id: u.id,
          prevItem: originalStrokes.find((s) => s.id === u.id)!,
          nextX: u.x,
          nextY: u.y,
          nextWidth: u.width,
          nextHeight: u.height,
          nextRelativePoints: u.relativePoints,
        })),
        deletedItemIds: deletedIds,
      });

      // 4. Asynchronously persist database operations in parallel in background
      beginSave();
      try {
        const [createdItems] = await Promise.all([
          Promise.all(
            newStrokes.map((stroke) =>
              moodboardService.createItem({
                projectId,
                referenceId: stroke.referenceId,
                type: 'stroke',
                content: stroke.content as unknown as Json,
                x: stroke.x,
                y: stroke.y,
                width: stroke.width,
                height: stroke.height,
                zIndex: stroke.zIndex,
              })
            )
          ),
          Promise.all(
            updates.map((u) => {
              const original = originalStrokes.find((s) => s.id === u.id);
              const origContent = (original?.content as StrokeItemContent) || {};
              const nextContent: StrokeItemContent = {
                ...origContent,
                points: u.relativePoints,
              };
              return moodboardService.updateItem(u.id, {
                x: u.x,
                y: u.y,
                width: u.width,
                height: u.height,
                content: nextContent as unknown as Json,
              });
            })
          ),
          deletedIds.length > 0
            ? Promise.all(deletedIds.map((id) => moodboardService.softDeleteItem(id)))
            : Promise.resolve([]),
        ]);

        // Reconcile optimistic IDs to persistent DB IDs across items state and both history stacks
        if (createdItems.length > 0) {
          const tempToReal = new Map<string, MoodboardItem>();
          optimisticCreated.forEach((temp, i) => {
            if (createdItems[i]) {
              tempToReal.set(temp.id, createdItems[i]);
            }
          });

          setItems((prev) =>
            prev.map((item) => {
              const real = tempToReal.get(item.id);
              return real ? { ...real, content: item.content } : item;
            })
          );

          reconcileHistoryIds(tempToReal);
        }

        endSave();
      } catch (err) {
        endSave(err);
      }
    },
    [beginSave, endSave, projectId, recordUndoAction, reconcileHistoryIds]
  );

  // Bulk delete all selected items
  const deleteSelectedItems = async () => {
    if (selectedIds.length === 0) return;
    const targets = items.filter((i) => selectedIds.includes(i.id));
    await batchDeleteItems(targets);
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
      const fit = calculateZoomToFit(items, containerWidth, containerHeight);
      setViewport(fit);
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
      return getConnectedReferenceIdsForIdea(itemId, items);
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
    canUndo,
    canRedo,
    recordUndoAction,
    undo,
    redo,
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
    addStrokeItem,
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
    batchDeleteItems,
    commitPartialErase,
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
