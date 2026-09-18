'use client';

import { useState, useEffect, useCallback } from 'react';
import { storyboardService } from '../services/storyboardService';
import type {
  StoryboardSceneWithShots,
  StoryboardScene,
  StoryboardSceneUpdate,
  StoryboardShotWithLinks,
  StoryboardShot,
  StoryboardShotConnection,
  AnchorPosition,
  AspectRatio,
  ShotType,
  CameraMovement,
  ShotVisualSource,
} from '../types';

export interface UseStoryboardReturn {
  scenes: StoryboardSceneWithShots[];
  connections: StoryboardShotConnection[];
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
  selectScene: (id: string | null) => void;
  selectShot: (id: string | null) => void;
}

export function useStoryboard(projectId: string): UseStoryboardReturn {
  const [scenes, setScenes] = useState<StoryboardSceneWithShots[]>([]);
  const [connections, setConnections] = useState<StoryboardShotConnection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  const fetchStoryboard = useCallback(async () => {
    if (!projectId) {
      setScenes([]);
      setConnections([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const [data, conns] = await Promise.all([
        storyboardService.getScenesWithShots(projectId),
        storyboardService.getConnections(projectId),
      ]);
      setScenes(data);
      setConnections(conns);
    } catch (err) {
      console.error('Failed to load storyboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load storyboard');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

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

  return {
    scenes,
    connections,
    isLoading,
    error,
    selectedSceneId,
    selectedShotId,
    totalShotsCount,
    refresh: fetchStoryboard,
    createScene: handleCreateScene,
    updateScene: handleUpdateScene,
    deleteScene: handleDeleteScene,
    createShot: handleCreateShot,
    updateShot: handleUpdateShot,
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
    selectScene: setSelectedSceneId,
    selectShot: setSelectedShotId,
  };
}
