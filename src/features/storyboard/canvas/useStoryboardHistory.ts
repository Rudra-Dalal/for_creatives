'use client';

/**
 * useStoryboardHistory.ts
 *
 * Dedicated undo/redo history state and coordinator for the storyboard canvas.
 *
 * Implements a bounded stack (capped at 50 operations) of reversible logical operations.
 * Designed to live in a stable hook in StoryboardCanvas or StoryboardView.
 * Does NOT reset when the user changes tools, selection, or opens inspectors.
 *
 * Symmetrical soft-delete and restore operations ensure:
 *  - 100% ID stability across undo and redo cycles.
 *  - No database row duplication on replay.
 *  - Cross-entity relationships (shots to scenes, references, direction notes, sequence connections)
 *    are fully preserved upon restoration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { sbPushToStack, sbPopFromStack, STORYBOARD_MAX_HISTORY_DEPTH } from './storyboardHistoryStack';
import type {
  StoryboardShot,
  StoryboardSceneUpdate,
  StoryboardShotConnection,
  StoryboardStroke,
  AnchorPosition,
} from '../types';

// ---- UndoAction discriminated union ----------------------------------------

export type StoryboardUndoAction =
  | {
      type: 'MOVE_SHOTS';
      shots: Array<{
        id: string;
        prevX: number;
        prevY: number;
        nextX: number;
        nextY: number;
      }>;
    }
  | {
      type: 'RESIZE_SHOT';
      shotId: string;
      prev: { width: number; height?: number };
      next: { width: number; height?: number };
    }
  | {
      type: 'UPDATE_SHOT';
      shotId: string;
      prev: Partial<StoryboardShot>;
      next: Partial<StoryboardShot>;
    }
  | {
      type: 'REASSIGN_SHOT_SCENE';
      shotId: string;
      prevSceneId: string;
      nextSceneId: string;
    }
  | {
      type: 'REORDER_SHOTS';
      sceneId: string;
      prevShotIds: string[];
      nextShotIds: string[];
    }
  | {
      type: 'CREATE_SHOT';
      shotId: string;
    }
  | {
      type: 'DELETE_SHOT';
      shotId: string;
    }
  | {
      type: 'BATCH_DELETE_SHOTS';
      shotIds: string[];
    }
  | {
      type: 'CREATE_SCENE';
      sceneId: string;
    }
  | {
      type: 'DELETE_SCENE';
      sceneId: string;
    }
  | {
      type: 'MOVE_SCENE';
      sceneId: string;
      prevPos: { x: number; y: number };
      nextPos: { x: number; y: number };
      memberShots?: Array<{
        id: string;
        prevX: number;
        prevY: number;
        nextX: number;
        nextY: number;
      }>;
    }
  | {
      type: 'RESIZE_SCENE';
      sceneId: string;
      prevSize: { width: number; height: number };
      nextSize: { width: number; height: number };
    }
  | {
      type: 'UPDATE_SCENE';
      sceneId: string;
      prev: Partial<StoryboardSceneUpdate>;
      next: Partial<StoryboardSceneUpdate>;
    }
  | {
      type: 'REORDER_SCENES';
      prevSceneIds: string[];
      nextSceneIds: string[];
    }
  | {
      type: 'CREATE_CONNECTION';
      connectionId: string;
    }
  | {
      type: 'DELETE_CONNECTION';
      connectionId: string;
    }
  | {
      type: 'UPDATE_CONNECTION';
      connectionId: string;
      prev: { fromAnchor?: AnchorPosition; toAnchor?: AnchorPosition; transitionLabel?: string };
      next: { fromAnchor?: AnchorPosition; toAnchor?: AnchorPosition; transitionLabel?: string };
    }
  | {
      type: 'ADD_STROKE';
      strokeId: string;
    }
  | {
      type: 'ERASE_STROKE';
      strokeId: string;
    }
  | {
      type: 'BATCH_ERASE_STROKES';
      strokeIds: string[];
    };

// ---- Hook Callbacks --------------------------------------------------------

export interface UseStoryboardHistoryCallbacks {
  // Shot operations
  onDeleteShot?: (id: string) => Promise<void>;
  onRestoreShot?: (id: string) => Promise<void>;
  onUpdateShot?: (id: string, updates: Partial<StoryboardShot>) => Promise<void>;
  onBatchUpdateShotPositions?: (
    updates: Array<{ id: string; x: number; y: number; zIndex?: number }>
  ) => Promise<void>;
  onReassignShotScene?: (shotId: string, targetSceneId: string) => Promise<void>;
  onReorderShots?: (sceneId: string, orderedShotIds: string[]) => Promise<void>;

  // Scene operations
  onDeleteScene?: (id: string) => Promise<void>;
  onRestoreScene?: (id: string) => Promise<void>;
  onUpdateScene?: (id: string, updates: Partial<StoryboardSceneUpdate>) => Promise<void>;
  onReorderScenes?: (orderedSceneIds: string[]) => Promise<void>;

  // Connection operations
  onDeleteConnection?: (id: string) => Promise<void>;
  onRestoreConnection?: (id: string) => Promise<StoryboardShotConnection | null>;
  onUpdateConnection?: (
    id: string,
    updates: { fromAnchor?: AnchorPosition; toAnchor?: AnchorPosition; transitionLabel?: string }
  ) => Promise<void>;

  // Stroke operations
  onEraseStroke?: (id: string) => Promise<boolean>;
  onRestoreStroke?: (id: string) => Promise<StoryboardStroke | null>;
}

export interface UseStoryboardHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  pushAction: (action: StoryboardUndoAction) => void;
  clearRedoOnNewAction: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  undoStack: readonly StoryboardUndoAction[];
  redoStack: readonly StoryboardUndoAction[];
  clearHistory: () => void;
}

// ---- Pure History Coordinator Class (Zero React dependency) ----------------

export class StoryboardHistoryManager {
  private undoStack: StoryboardUndoAction[] = [];
  private redoStack: StoryboardUndoAction[] = [];
  public callbacks: UseStoryboardHistoryCallbacks;

  constructor(callbacks: UseStoryboardHistoryCallbacks = {}) {
    this.callbacks = callbacks;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndos(): readonly StoryboardUndoAction[] {
    return this.undoStack;
  }

  getRedos(): readonly StoryboardUndoAction[] {
    return this.redoStack;
  }

  pushAction(action: StoryboardUndoAction): void {
    this.undoStack = sbPushToStack(this.undoStack, action);
    this.redoStack = [];
  }

  clearRedo(): void {
    this.redoStack = [];
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  async undo(): Promise<boolean> {
    const { action, remaining } = sbPopFromStack(this.undoStack);
    if (!action) return false;

    try {
      await this.applyUndo(action);
      this.undoStack = remaining;
      this.redoStack = sbPushToStack(this.redoStack, action);
      return true;
    } catch (err) {
      console.error('Storyboard undo failed:', err);
      throw err;
    }
  }

  async redo(): Promise<boolean> {
    const { action, remaining } = sbPopFromStack(this.redoStack);
    if (!action) return false;

    try {
      await this.applyRedo(action);
      this.redoStack = remaining;
      this.undoStack = sbPushToStack(this.undoStack, action);
      return true;
    } catch (err) {
      console.error('Storyboard redo failed:', err);
      throw err;
    }
  }

  async applyUndo(action: StoryboardUndoAction): Promise<void> {
    const cb = this.callbacks;

    switch (action.type) {
      case 'MOVE_SHOTS': {
        if (!cb.onBatchUpdateShotPositions) return;
        const prevPositions = action.shots.map((s) => ({
          id: s.id,
          x: s.prevX,
          y: s.prevY,
        }));
        await cb.onBatchUpdateShotPositions(prevPositions);
        break;
      }

      case 'RESIZE_SHOT': {
        if (!cb.onUpdateShot) return;
        await cb.onUpdateShot(action.shotId, action.prev);
        break;
      }

      case 'UPDATE_SHOT': {
        if (!cb.onUpdateShot) return;
        await cb.onUpdateShot(action.shotId, action.prev);
        break;
      }

      case 'REASSIGN_SHOT_SCENE': {
        if (!cb.onReassignShotScene) return;
        await cb.onReassignShotScene(action.shotId, action.prevSceneId);
        break;
      }

      case 'REORDER_SHOTS': {
        if (!cb.onReorderShots) return;
        await cb.onReorderShots(action.sceneId, action.prevShotIds);
        break;
      }

      case 'CREATE_SHOT': {
        if (!cb.onDeleteShot) return;
        await cb.onDeleteShot(action.shotId);
        break;
      }

      case 'DELETE_SHOT': {
        if (!cb.onRestoreShot) return;
        await cb.onRestoreShot(action.shotId);
        break;
      }

      case 'BATCH_DELETE_SHOTS': {
        if (!cb.onRestoreShot) return;
        for (const id of action.shotIds) {
          await cb.onRestoreShot(id);
        }
        break;
      }

      case 'CREATE_SCENE': {
        if (!cb.onDeleteScene) return;
        await cb.onDeleteScene(action.sceneId);
        break;
      }

      case 'DELETE_SCENE': {
        if (!cb.onRestoreScene) return;
        await cb.onRestoreScene(action.sceneId);
        break;
      }

      case 'MOVE_SCENE': {
        if (cb.onUpdateScene) {
          await cb.onUpdateScene(action.sceneId, action.prevPos);
        }
        if (cb.onBatchUpdateShotPositions && action.memberShots && action.memberShots.length > 0) {
          const memberPositions = action.memberShots.map((s) => ({
            id: s.id,
            x: s.prevX,
            y: s.prevY,
          }));
          await cb.onBatchUpdateShotPositions(memberPositions);
        }
        break;
      }

      case 'RESIZE_SCENE': {
        if (!cb.onUpdateScene) return;
        await cb.onUpdateScene(action.sceneId, action.prevSize);
        break;
      }

      case 'UPDATE_SCENE': {
        if (!cb.onUpdateScene) return;
        await cb.onUpdateScene(action.sceneId, action.prev);
        break;
      }

      case 'REORDER_SCENES': {
        if (!cb.onReorderScenes) return;
        await cb.onReorderScenes(action.prevSceneIds);
        break;
      }

      case 'CREATE_CONNECTION': {
        if (!cb.onDeleteConnection) return;
        await cb.onDeleteConnection(action.connectionId);
        break;
      }

      case 'DELETE_CONNECTION': {
        if (!cb.onRestoreConnection) return;
        await cb.onRestoreConnection(action.connectionId);
        break;
      }

      case 'UPDATE_CONNECTION': {
        if (!cb.onUpdateConnection) return;
        await cb.onUpdateConnection(action.connectionId, action.prev);
        break;
      }

      case 'ADD_STROKE': {
        if (!cb.onEraseStroke) return;
        await cb.onEraseStroke(action.strokeId);
        break;
      }

      case 'ERASE_STROKE': {
        if (!cb.onRestoreStroke) return;
        await cb.onRestoreStroke(action.strokeId);
        break;
      }

      case 'BATCH_ERASE_STROKES': {
        if (!cb.onRestoreStroke) return;
        for (const id of action.strokeIds) {
          await cb.onRestoreStroke(id);
        }
        break;
      }
    }
  }

  async applyRedo(action: StoryboardUndoAction): Promise<void> {
    const cb = this.callbacks;

    switch (action.type) {
      case 'MOVE_SHOTS': {
        if (!cb.onBatchUpdateShotPositions) return;
        const nextPositions = action.shots.map((s) => ({
          id: s.id,
          x: s.nextX,
          y: s.nextY,
        }));
        await cb.onBatchUpdateShotPositions(nextPositions);
        break;
      }

      case 'RESIZE_SHOT': {
        if (!cb.onUpdateShot) return;
        await cb.onUpdateShot(action.shotId, action.next);
        break;
      }

      case 'UPDATE_SHOT': {
        if (!cb.onUpdateShot) return;
        await cb.onUpdateShot(action.shotId, action.next);
        break;
      }

      case 'REASSIGN_SHOT_SCENE': {
        if (!cb.onReassignShotScene) return;
        await cb.onReassignShotScene(action.shotId, action.nextSceneId);
        break;
      }

      case 'REORDER_SHOTS': {
        if (!cb.onReorderShots) return;
        await cb.onReorderShots(action.sceneId, action.nextShotIds);
        break;
      }

      case 'CREATE_SHOT': {
        if (!cb.onRestoreShot) return;
        await cb.onRestoreShot(action.shotId);
        break;
      }

      case 'DELETE_SHOT': {
        if (!cb.onDeleteShot) return;
        await cb.onDeleteShot(action.shotId);
        break;
      }

      case 'BATCH_DELETE_SHOTS': {
        if (!cb.onDeleteShot) return;
        for (const id of action.shotIds) {
          await cb.onDeleteShot(id);
        }
        break;
      }

      case 'CREATE_SCENE': {
        if (!cb.onRestoreScene) return;
        await cb.onRestoreScene(action.sceneId);
        break;
      }

      case 'DELETE_SCENE': {
        if (!cb.onDeleteScene) return;
        await cb.onDeleteScene(action.sceneId);
        break;
      }

      case 'MOVE_SCENE': {
        if (cb.onUpdateScene) {
          await cb.onUpdateScene(action.sceneId, action.nextPos);
        }
        if (cb.onBatchUpdateShotPositions && action.memberShots && action.memberShots.length > 0) {
          const memberPositions = action.memberShots.map((s) => ({
            id: s.id,
            x: s.nextX,
            y: s.nextY,
          }));
          await cb.onBatchUpdateShotPositions(memberPositions);
        }
        break;
      }

      case 'RESIZE_SCENE': {
        if (!cb.onUpdateScene) return;
        await cb.onUpdateScene(action.sceneId, action.nextSize);
        break;
      }

      case 'UPDATE_SCENE': {
        if (!cb.onUpdateScene) return;
        await cb.onUpdateScene(action.sceneId, action.next);
        break;
      }

      case 'REORDER_SCENES': {
        if (!cb.onReorderScenes) return;
        await cb.onReorderScenes(action.nextSceneIds);
        break;
      }

      case 'CREATE_CONNECTION': {
        if (!cb.onRestoreConnection) return;
        await cb.onRestoreConnection(action.connectionId);
        break;
      }

      case 'DELETE_CONNECTION': {
        if (!cb.onDeleteConnection) return;
        await cb.onDeleteConnection(action.connectionId);
        break;
      }

      case 'UPDATE_CONNECTION': {
        if (!cb.onUpdateConnection) return;
        await cb.onUpdateConnection(action.connectionId, action.next);
        break;
      }

      case 'ADD_STROKE': {
        if (!cb.onRestoreStroke) return;
        await cb.onRestoreStroke(action.strokeId);
        break;
      }

      case 'ERASE_STROKE': {
        if (!cb.onEraseStroke) return;
        await cb.onEraseStroke(action.strokeId);
        break;
      }

      case 'BATCH_ERASE_STROKES': {
        if (!cb.onEraseStroke) return;
        for (const id of action.strokeIds) {
          await cb.onEraseStroke(id);
        }
        break;
      }
    }
  }
}

// ---- React Hook Implementation ---------------------------------------------

export function useStoryboardHistory(
  callbacks: UseStoryboardHistoryCallbacks
): UseStoryboardHistoryReturn {
  const [undoStack, setUndoStack] = useState<StoryboardUndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<StoryboardUndoAction[]>([]);

  const managerRef = useRef<StoryboardHistoryManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new StoryboardHistoryManager(callbacks);
  }

  // Keep callbacks synchronized
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.callbacks = callbacks;
    }
  }, [callbacks]);

  const syncState = useCallback(() => {
    if (managerRef.current) {
      setUndoStack([...managerRef.current.getUndos()]);
      setRedoStack([...managerRef.current.getRedos()]);
    }
  }, []);

  const pushAction = useCallback((action: StoryboardUndoAction) => {
    managerRef.current?.pushAction(action);
    syncState();
  }, [syncState]);

  const clearRedoOnNewAction = useCallback(() => {
    managerRef.current?.clearRedo();
    syncState();
  }, [syncState]);

  const clearHistory = useCallback(() => {
    managerRef.current?.clear();
    syncState();
  }, [syncState]);

  const undo = useCallback(async () => {
    try {
      await managerRef.current?.undo();
    } finally {
      syncState();
    }
  }, [syncState]);

  const redo = useCallback(async () => {
    try {
      await managerRef.current?.redo();
    } finally {
      syncState();
    }
  }, [syncState]);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushAction,
    clearRedoOnNewAction,
    undo,
    redo,
    undoStack,
    redoStack,
    clearHistory,
  };
}
