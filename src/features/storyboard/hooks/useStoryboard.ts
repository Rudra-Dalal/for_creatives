'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { storyboardService } from '../services/storyboardService';
import type {
  StoryboardSceneWithShots,
  StoryboardScene,
  StoryboardSceneUpdate,
  StoryboardShotWithLinks,
  StoryboardShot,
  StoryboardShotConnection,
  StoryboardStroke,
  AnchorPosition,
  AspectRatio,
  ShotType,
  CameraMovement,
  ShotVisualSource,
} from '../types';

export interface UseStoryboardReturn {
  scenes: StoryboardSceneWithShots[];
  connections: StoryboardShotConnection[];
  strokes: StoryboardStroke[];
  isLoading: boolean;
  error: string | null;
  selectedSceneId: string | null;
  selectedShotId: string | null;
  totalShotsCount: number;
  refresh: () => Promise<void>;
  createScene: (title?: string, description?: string, x?: number, y?: number, width?: number, height?: number) => Promise<StoryboardScene | null>;
  updateScene: (id: string, updates: Partial<StoryboardSceneUpdate>) => Promise<void>;
  deleteScene: (id: string) => Promise<void>;
  createShot: (sceneId: string, data?: {
    shotNumber?: string;
    title?: string;
    description?: string;
    dialogue?: string;
    aspectRatio?: AspectRatio;
    shotType?: ShotType | null;
    cameraMovement?: CameraMovement | null;
    visualUrl?: string;
    visualSource?: ShotVisualSource;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    zIndex?: number;
  }) => Promise<StoryboardShotWithLinks | null>;
  updateShot: (id: string, updates: Partial<StoryboardShot>) => Promise<void>;
  updateShotVisualFrame: (
    shotId: string,
    visualUrl: string,
    visualSource: ShotVisualSource
  ) => Promise<void>;
  deleteShot: (id: string) => Promise<void>;
  duplicateShot: (id: string) => Promise<StoryboardShotWithLinks | null>;
  reassignShotScene: (shotId: string, targetSceneId: string) => Promise<void>;
  batchUpdateShotPositions: (updates: Array<{ id: string; x: number; y: number; zIndex?: number }>) => Promise<void>;
  reorderShots: (sceneId: string, orderedShotIds: string[]) => Promise<void>;
  reorderScenes: (orderedSceneIds: string[]) => Promise<void>;
  createConnection: (input: {
    fromShotId: string;
    toShotId: string;
    fromAnchor?: AnchorPosition;
    toAnchor?: AnchorPosition;
    transitionLabel?: string;
  }) => Promise<StoryboardShotConnection | null>;
  updateConnection: (id: string, updates: { fromAnchor?: AnchorPosition; toAnchor?: AnchorPosition; transitionLabel?: string }) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  restoreConnection: (id: string) => Promise<StoryboardShotConnection | null>;
  restoreShot: (id: string) => Promise<void>;
  restoreScene: (id: string) => Promise<void>;
  restoreStroke: (id: string) => Promise<StoryboardStroke | null>;
  addStroke: (points: number[], strokeColor: string, strokeWidth: number) => Promise<StoryboardStroke | null>;
  eraseStroke: (id: string) => Promise<boolean>;
  selectScene: (id: string | null) => void;
  selectShot: (id: string | null) => void;
}

export function useStoryboard(projectId: string): UseStoryboardReturn {
  const [scenes, setScenes] = useState<StoryboardSceneWithShots[]>([]);
  const [connections, setConnections] = useState<StoryboardShotConnection[]>([]);
  const [strokes, setStrokes] = useState<StoryboardStroke[]>([]);
  const strokesRef = useRef<StoryboardStroke[]>([]);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setErrorState] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const setError = useCallback((msg: string | null) => {
    errorRef.current = msg;
    setErrorState(msg);
  }, []);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  const fetchStoryboard = useCallback(async () => {
    if (!projectId) {
      setScenes([]);
      setConnections([]);
      setStrokes([]);
      strokesRef.current = [];
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [data, conns, strokeRows] = await Promise.all([
        storyboardService.getScenesWithShots(projectId),
        storyboardService.getConnections(projectId),
        storyboardService.getStrokes(projectId),
      ]);
      setScenes(data);
      setConnections(conns);
      setStrokes(strokeRows);
      strokesRef.current = strokeRows;
    } catch (err) {
      console.error('Failed to load storyboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load storyboard');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, setError]);

  useEffect(() => {
    fetchStoryboard();
  }, [fetchStoryboard]);

  const totalShotsCount = scenes.reduce((acc, scene) => acc + scene.shots.length, 0);

  const handleCreateScene = async (
    title?: string,
    description?: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number
  ): Promise<StoryboardScene | null> => {
    try {
      const created = await storyboardService.createScene({
        projectId,
        title,
        description,
        x,
        y,
        width,
        height,
      });
      await fetchStoryboard();
      return created;
    } catch (err) {
      console.error('Failed to create scene:', err);
      setError(err instanceof Error ? err.message : 'Failed to create scene');
      return null;
    }
  };

  const handleUpdateScene = async (id: string, updates: Partial<StoryboardSceneUpdate>): Promise<void> => {
    try {
      await storyboardService.updateScene(id, updates);
      setScenes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    } catch (err) {
      console.error('Failed to update scene:', err);
      setError(err instanceof Error ? err.message : 'Failed to update scene');
      throw err;
    }
  };

  const handleDeleteScene = async (id: string): Promise<void> => {
    try {
      await storyboardService.deleteScene(id);
      setScenes((prev) => prev.filter((s) => s.id !== id));
      if (selectedSceneId === id) setSelectedSceneId(null);
    } catch (err) {
      console.error('Failed to delete scene:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete scene');
      throw err;
    }
  };

  const handleCreateShot = async (
    sceneId: string,
    data?: {
      shotNumber?: string;
      title?: string;
      description?: string;
      dialogue?: string;
      aspectRatio?: AspectRatio;
      shotType?: ShotType | null;
      cameraMovement?: CameraMovement | null;
      visualUrl?: string;
      visualSource?: ShotVisualSource;
    }
  ): Promise<StoryboardShotWithLinks | null> => {
    try {
      const shot = await storyboardService.createShot({
        projectId,
        sceneId,
        ...data,
      });
      await fetchStoryboard();
      return shot;
    } catch (err) {
      console.error('Failed to create shot:', err);
      setError(err instanceof Error ? err.message : 'Failed to create shot');
      return null;
    }
  };

  const handleUpdateShot = async (id: string, updates: Partial<StoryboardShot>): Promise<void> => {
    try {
      await storyboardService.updateShot(id, updates);
      setScenes((prev) =>
        prev.map((scene) => ({
          ...scene,
          shots: scene.shots.map((shot) =>
            shot.id === id ? ({ ...shot, ...updates } as StoryboardShotWithLinks) : shot
          ),
        }))
      );
    } catch (err) {
      console.error('Failed to update shot:', err);
      setError(err instanceof Error ? err.message : 'Failed to update shot');
      throw err;
    }
  };

  const handleUpdateShotVisualFrame = async (
    shotId: string,
    visualUrl: string,
    visualSource: ShotVisualSource
  ): Promise<void> => {
    return handleUpdateShot(shotId, {
      visual_url: visualUrl,
      visual_source: visualSource,
    });
  };

  const handleDeleteShot = async (id: string): Promise<void> => {
    try {
      await storyboardService.deleteShot(id);
      setScenes((prev) =>
        prev.map((scene) => ({
          ...scene,
          shots: scene.shots.filter((shot) => shot.id !== id),
        }))
      );
      if (selectedShotId === id) setSelectedShotId(null);
    } catch (err) {
      console.error('Failed to delete shot:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete shot');
      throw err;
    }
  };

  const handleDuplicateShot = async (id: string): Promise<StoryboardShotWithLinks | null> => {
    try {
      const duplicated = await storyboardService.duplicateShot(id);
      await fetchStoryboard();
      return duplicated;
    } catch (err) {
      console.error('Failed to duplicate shot:', err);
      setError(err instanceof Error ? err.message : 'Failed to duplicate shot');
      return null;
    }
  };

  const handleReassignShotScene = async (shotId: string, targetSceneId: string): Promise<void> => {
    try {
      await storyboardService.updateShot(shotId, { scene_id: targetSceneId });
      await fetchStoryboard();
    } catch (err) {
      console.error('Failed to reassign shot scene:', err);
      setError(err instanceof Error ? err.message : 'Failed to reassign shot');
      throw err;
    }
  };

  const handleBatchUpdateShotPositions = async (
    updates: Array<{ id: string; x: number; y: number; zIndex?: number }>
  ): Promise<void> => {
    if (updates.length === 0) return;
    try {
      await storyboardService.batchUpdateShotPositions(updates);
      setScenes((prev) => {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        return prev.map((scene) => ({
          ...scene,
          shots: scene.shots.map((shot) => {
            const u = updateMap.get(shot.id);
            return u ? { ...shot, x: u.x, y: u.y } : shot;
          }),
        }));
      });
    } catch (err) {
      console.error('Failed to batch update shot positions:', err);
      await fetchStoryboard();
      throw err;
    }
  };

  const handleReorderShots = async (sceneId: string, orderedShotIds: string[]): Promise<void> => {
    // Optimistically reorder local state
    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const shotMap = new Map(scene.shots.map((s) => [s.id, s]));
        const reordered = orderedShotIds
          .map((id) => shotMap.get(id))
          .filter((s): s is StoryboardShotWithLinks => !!s);
        return { ...scene, shots: reordered };
      })
    );

    try {
      await storyboardService.reorderShots(sceneId, orderedShotIds);
    } catch (err) {
      console.error('Failed to persist shot order:', err);
      await fetchStoryboard(); // rollback on error
    }
  };

  const handleReorderScenes = async (orderedSceneIds: string[]): Promise<void> => {
    // Optimistically reorder local state
    setScenes((prev) => {
      const sceneMap = new Map(prev.map((s) => [s.id, s]));
      return orderedSceneIds
        .map((id) => sceneMap.get(id))
        .filter((s): s is StoryboardSceneWithShots => !!s);
    });

    try {
      await storyboardService.reorderScenes(projectId, orderedSceneIds);
    } catch (err) {
      console.error('Failed to persist scene order:', err);
      await fetchStoryboard(); // rollback on error
    }
  };

  const handleCreateConnection = async (input: {
    fromShotId: string;
    toShotId: string;
    fromAnchor?: AnchorPosition;
    toAnchor?: AnchorPosition;
    transitionLabel?: string;
  }): Promise<StoryboardShotConnection | null> => {
    try {
      const created = await storyboardService.createConnection({ projectId, ...input });
      // Optimistic update: append or replace any soft-deleted entry for this pair
      setConnections((prev) => {
        const filtered = prev.filter(
          (c) => !(c.from_shot_id === created.from_shot_id && c.to_shot_id === created.to_shot_id)
        );
        return [...filtered, created];
      });
      return created;
    } catch (err) {
      console.error('Failed to create connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to create connection');
      return null;
    }
  };

  const handleUpdateConnection = async (
    id: string,
    updates: { fromAnchor?: AnchorPosition; toAnchor?: AnchorPosition; transitionLabel?: string }
  ): Promise<void> => {
    try {
      const updated = await storyboardService.updateConnection(id, updates);
      setConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error('Failed to update connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to update connection');
      throw err;
    }
  };

  const handleDeleteConnection = async (id: string): Promise<void> => {
    try {
      await storyboardService.deleteConnection(id);
      // Remove from local state immediately — undo must call restoreConnection
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
      throw err;
    }
  };

  const handleRestoreConnection = async (id: string): Promise<StoryboardShotConnection | null> => {
    try {
      const restored = await storyboardService.restoreConnection(id);
      setConnections((prev) => {
        // Avoid duplicates if somehow still present in state
        const filtered = prev.filter((c) => c.id !== restored.id);
        return [...filtered, restored];
      });
      return restored;
    } catch (err) {
      console.error('Failed to restore connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore connection');
      return null;
    }
  };

  const handleAddStroke = async (
    points: number[],
    strokeColor: string,
    strokeWidth: number
  ): Promise<StoryboardStroke | null> => {
    const tempId = `temp-stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const tempStroke: StoryboardStroke = {
      id: tempId,
      project_id: projectId,
      points,
      stroke_color: strokeColor,
      stroke_width: strokeWidth,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    // 1. Optimistic append
    strokesRef.current = [...strokesRef.current, tempStroke];
    setStrokes((prev) => [...prev, tempStroke]);

    try {
      // 2. Persist to DB
      const created = await storyboardService.createStroke({
        projectId,
        points,
        strokeColor,
        strokeWidth,
      });

      // 3. Replace temp stroke with real DB row
      strokesRef.current = strokesRef.current.map((s) => (s.id === tempId ? created : s));
      setStrokes((prev) =>
        prev.map((s) => (s.id === tempId ? created : s))
      );

      return created;
    } catch (err) {
      console.error('Failed to create stroke:', err);
      // Rollback: remove only the temporary stroke
      strokesRef.current = strokesRef.current.filter((s) => s.id !== tempId);
      setStrokes((prev) => prev.filter((s) => s.id !== tempId));
      setError(err instanceof Error ? err.message : 'Failed to create stroke');
      return null;
    }
  };

  const handleEraseStroke = async (id: string): Promise<boolean> => {
    const existingIndex = strokesRef.current.findIndex((s) => s.id === id);
    const existingStroke = existingIndex !== -1 ? strokesRef.current[existingIndex] : null;

    if (!existingStroke || existingIndex === -1) {
      // Stroke not found in active state — safe no-op
      return false;
    }

    // 1. Optimistic removal
    strokesRef.current = strokesRef.current.filter((s) => s.id !== id);
    setStrokes((prev) => prev.filter((s) => s.id !== id));

    try {
      // 2. Persist to DB
      await storyboardService.softDeleteStroke(id);
      return true;
    } catch (err) {
      console.error('Failed to erase stroke:', err);
      // 3. Rollback: restore the exact original stroke to its original position
      const next = [...strokesRef.current];
      const targetIdx = Math.min(existingIndex, next.length);
      next.splice(targetIdx, 0, existingStroke);
      strokesRef.current = next;

      setStrokes((prev) => {
        if (prev.some((s) => s.id === id)) {
          return prev;
        }
        const pNext = [...prev];
        const pIdx = Math.min(existingIndex, pNext.length);
        pNext.splice(pIdx, 0, existingStroke);
        return pNext;
      });

      setError(err instanceof Error ? err.message : 'Failed to erase stroke');
      return false;
    }
  };

  const handleRestoreShot = async (id: string): Promise<void> => {
    try {
      await storyboardService.restoreShot(id);
      await fetchStoryboard();
    } catch (err) {
      console.error('Failed to restore shot:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore shot');
      throw err;
    }
  };

  const handleRestoreScene = async (id: string): Promise<void> => {
    try {
      await storyboardService.restoreScene(id);
      await fetchStoryboard();
    } catch (err) {
      console.error('Failed to restore scene:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore scene');
      throw err;
    }
  };

  const handleRestoreStroke = async (id: string): Promise<StoryboardStroke | null> => {
    try {
      const restored = await storyboardService.restoreStroke(id);
      strokesRef.current = [...strokesRef.current.filter((s) => s.id !== restored.id), restored];
      setStrokes((prev) => [...prev.filter((s) => s.id !== restored.id), restored]);
      return restored;
    } catch (err) {
      console.error('Failed to restore stroke:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore stroke');
      return null;
    }
  };

  return {
    scenes,
    connections,
    get strokes() {
      return strokesRef.current;
    },
    isLoading,
    get error() {
      return errorRef.current ?? error;
    },
    selectedSceneId,
    selectedShotId,
    totalShotsCount,
    refresh: fetchStoryboard,
    createScene: handleCreateScene,
    updateScene: handleUpdateScene,
    deleteScene: handleDeleteScene,
    createShot: handleCreateShot,
    updateShot: handleUpdateShot,
    updateShotVisualFrame: handleUpdateShotVisualFrame,
    deleteShot: handleDeleteShot,
    duplicateShot: handleDuplicateShot,
    reassignShotScene: handleReassignShotScene,
    batchUpdateShotPositions: handleBatchUpdateShotPositions,
    reorderShots: handleReorderShots,
    reorderScenes: handleReorderScenes,
    createConnection: handleCreateConnection,
    updateConnection: handleUpdateConnection,
    deleteConnection: handleDeleteConnection,
    restoreConnection: handleRestoreConnection,
    restoreShot: handleRestoreShot,
    restoreScene: handleRestoreScene,
    restoreStroke: handleRestoreStroke,
    addStroke: handleAddStroke,
    eraseStroke: handleEraseStroke,
    selectScene: setSelectedSceneId,
    selectShot: setSelectedShotId,
  };
};
