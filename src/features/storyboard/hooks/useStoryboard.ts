'use client';

import { useState, useEffect, useCallback } from 'react';
import { storyboardService } from '../services/storyboardService';
import type {
  StoryboardSceneWithShots,
  StoryboardScene,
  StoryboardShotWithLinks,
  StoryboardShot,
  AspectRatio,
  ShotType,
  CameraMovement,
  ShotVisualSource,
} from '../types';

export interface UseStoryboardReturn {
  scenes: StoryboardSceneWithShots[];
  isLoading: boolean;
  error: string | null;
  selectedSceneId: string | null;
  selectedShotId: string | null;
  totalShotsCount: number;
  refresh: () => Promise<void>;
  createScene: (title?: string, description?: string) => Promise<StoryboardScene | null>;
  updateScene: (id: string, updates: { title?: string; description?: string }) => Promise<void>;
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
  }) => Promise<StoryboardShotWithLinks | null>;
  updateShot: (id: string, updates: Partial<StoryboardShot>) => Promise<void>;
  deleteShot: (id: string) => Promise<void>;
  duplicateShot: (id: string) => Promise<StoryboardShotWithLinks | null>;
  reorderShots: (sceneId: string, orderedShotIds: string[]) => Promise<void>;
  reorderScenes: (orderedSceneIds: string[]) => Promise<void>;
  selectScene: (id: string | null) => void;
  selectShot: (id: string | null) => void;
}

export function useStoryboard(projectId: string): UseStoryboardReturn {
  const [scenes, setScenes] = useState<StoryboardSceneWithShots[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);

  const fetchStoryboard = useCallback(async () => {
    if (!projectId) {
      setScenes([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await storyboardService.getScenesWithShots(projectId);
      setScenes(data);
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

  const handleCreateScene = async (title?: string, description?: string): Promise<StoryboardScene | null> => {
    try {
      const created = await storyboardService.createScene({
        projectId,
        title,
        description,
      });
      await fetchStoryboard();
      return created;
    } catch (err) {
      console.error('Failed to create scene:', err);
      setError(err instanceof Error ? err.message : 'Failed to create scene');
      return null;
    }
  };

  const handleUpdateScene = async (id: string, updates: { title?: string; description?: string }): Promise<void> => {
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

  return {
    scenes,
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
    reorderShots: handleReorderShots,
    reorderScenes: handleReorderScenes,
    selectScene: setSelectedSceneId,
    selectShot: setSelectedShotId,
  };
}
