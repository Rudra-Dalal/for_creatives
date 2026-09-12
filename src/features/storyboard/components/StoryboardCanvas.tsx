'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type Konva from 'konva';
import { StoryboardStage } from '../canvas/StoryboardStage';
import { StoryboardToolbar } from './StoryboardToolbar';
import { SceneRegionNode } from '../canvas/SceneRegionNode';
import { ShotCardNode } from '../canvas/ShotCardNode';
import { StoryboardShotInspector } from './StoryboardShotInspector';
import { StoryboardSceneInspector } from './StoryboardSceneInspector';
import {
  clampScale,
  calculateZoomToFit,
  stagePointToCanvas,
} from '../utils/storyboardCoordinates';
import {
  calculateNextScenePosition,
  calculateNextShotPosition,
  calculateMemberShotsDelta,
  isPointOverSceneHeader,
  findIntersectingShots,
  SCENE_MIN_WIDTH,
  SCENE_MIN_HEIGHT,
} from '../utils/storyboardGeometry';
import type {
  StoryboardViewport,
  StoryboardTool,
  StoryboardSceneWithShots,
  StoryboardShotWithLinks,
  StoryboardScene,
  StoryboardBounds,
  StoryboardPoint,
  StoryboardSceneUpdate,
  StoryboardShot,
} from '../types';

export interface StoryboardCanvasProps {
  projectId: string;
  projectName?: string;
  scenes?: StoryboardSceneWithShots[];
  readOnly?: boolean;
  onCreateScene?: (
    title?: string,
    description?: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number
  ) => Promise<StoryboardScene | null>;
  onUpdateScene?: (id: string, updates: Partial<StoryboardSceneUpdate>) => Promise<void>;
  onDeleteScene?: (id: string) => Promise<void>;
  onCreateShot?: (
    sceneId: string,
    data?: {
      shotNumber?: string;
      title?: string;
      description?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  ) => Promise<StoryboardShotWithLinks | null>;
  onUpdateShot?: (id: string, updates: Partial<StoryboardShot>) => Promise<void>;
  onDeleteShot?: (id: string) => Promise<void>;
  onDuplicateShot?: (id: string) => Promise<StoryboardShotWithLinks | null>;
  onReassignShotScene?: (shotId: string, targetSceneId: string) => Promise<void>;
  onBatchUpdateShotPositions?: (
    updates: Array<{ id: string; x: number; y: number; zIndex?: number }>
  ) => Promise<void>;
  children?: React.ReactNode;
}

export function StoryboardCanvas({
  projectId,
  projectName = 'Storyboard',
  scenes = [],
  readOnly = false,
  onCreateScene,
  onUpdateScene,
  onDeleteScene,
  onCreateShot,
  onUpdateShot,
  onDeleteShot,
  onDuplicateShot,
  onReassignShotScene,
  onBatchUpdateShotPositions,
  children,
}: StoryboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 800,
  });

  const [activeTool, setActiveTool] = useState<StoryboardTool>('select');

  // Selection state
  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  // Marquee state
  const isMarqueeActiveRef = useRef<boolean>(false);
  const marqueeStartPointRef = useRef<StoryboardPoint | null>(null);
  const [marqueeBounds, setMarqueeBounds] = useState<StoryboardBounds | null>(null);

  // Deliberate Scene Header Hover Target for Reparenting
  const [headerHoveredSceneId, setHeaderHoveredSceneId] = useState<string | null>(null);

  // Scene Dragging member shots delta tracking
  const sceneMemberStartPositionsRef = useRef<
    Map<string, { id: string; x: number; y: number }>
  >(new Map());

  // Multi-Shot Dragging start positions tracking
  const multiShotStartPositionsRef = useRef<
    Map<string, { id: string; x: number; y: number }>
  >(new Map());

  // Viewport state with localStorage persistence
  const [viewport, setViewport] = useState<StoryboardViewport>(() => {
    if (typeof window !== 'undefined' && projectId) {
      try {
        const saved = localStorage.getItem(`storyboard_viewport_${projectId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            typeof parsed.x === 'number' &&
            typeof parsed.y === 'number' &&
            typeof parsed.scale === 'number'
          ) {
            return {
              x: parsed.x,
              y: parsed.y,
              scale: clampScale(parsed.scale),
            };
          }
        }
      } catch {
        // ignore JSON parse error
      }
    }
    return { x: 0, y: 0, scale: 1.0 };
  });

  // Responsive dimension tracking via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleViewportChange = useCallback(
    (newViewport: StoryboardViewport) => {
      setViewport(newViewport);
      if (typeof window !== 'undefined' && projectId) {
        try {
          localStorage.setItem(
            `storyboard_viewport_${projectId}`,
            JSON.stringify(newViewport)
          );
        } catch {
          // ignore quota
        }
      }
    },
    [projectId]
  );

  // Zoom to fit calculation
  const handleZoomToFit = useCallback(() => {
    const allBounds: StoryboardBounds[] = [];

    for (const scene of scenes) {
      allBounds.push({
        x: scene.x,
        y: scene.y,
        width: scene.width,
        height: scene.height,
      });

      for (const shot of scene.shots) {
        allBounds.push({
          x: shot.x,
          y: shot.y,
          width: shot.width,
          height: shot.height,
        });
      }
    }

    const fitted = calculateZoomToFit(
      allBounds,
      dimensions.width,
      dimensions.height,
      80
    );
    handleViewportChange(fitted);
  }, [scenes, dimensions.width, dimensions.height, handleViewportChange]);

  // Flatten all shots for convenient querying
  const allShots: StoryboardShotWithLinks[] = React.useMemo(() => {
    return scenes.flatMap((s) => s.shots);
  }, [scenes]);

  // Currently selected primary shot (for inspector)
  const selectedShot = React.useMemo(() => {
    if (selectedShotIds.size === 0) return null;
    const firstId = Array.from(selectedShotIds)[0];
    return allShots.find((s) => s.id === firstId) || null;
  }, [selectedShotIds, allShots]);

  // Currently selected primary scene (for inspector)
  const selectedScene = React.useMemo(() => {
    if (!selectedSceneId) return null;
    return scenes.find((s) => s.id === selectedSceneId) || null;
  }, [selectedSceneId, scenes]);

  // --------------------------------------------------------------------------
  // SELECTION HANDLERS
  // --------------------------------------------------------------------------

  const handleSelectShot = useCallback(
    (shotId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      const isMulti = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;

      setSelectedSceneId(null);
      setSelectedShotIds((prev) => {
        const next = new Set(prev);
        if (isMulti) {
          if (next.has(shotId)) {
            next.delete(shotId);
          } else {
            next.add(shotId);
          }
          return next;
        }
        return new Set([shotId]);
      });
    },
    []
  );

  const handleSelectScene = useCallback(
    (sceneId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      setSelectedShotIds(new Set());
      setSelectedSceneId(sceneId);
    },
    []
  );

  const handleClearSelection = useCallback(() => {
    setSelectedShotIds(new Set());
    setSelectedSceneId(null);
  }, []);

  // --------------------------------------------------------------------------
  // SCENE DRAG & RESIZE HANDLERS (GROUP MOVEMENT)
  // --------------------------------------------------------------------------

  const handleSceneDragStart = useCallback(
    (sceneId: string) => {
      setSelectedSceneId(sceneId);
      setSelectedShotIds(new Set());

      // Cache initial positions of member shots belonging to this scene
      const memberShots = allShots.filter((s) => s.scene_id === sceneId);
      const startMap = new Map<string, { id: string; x: number; y: number }>();
      for (const shot of memberShots) {
        startMap.set(shot.id, { id: shot.id, x: shot.x, y: shot.y });
      }
      sceneMemberStartPositionsRef.current = startMap;
    },
    [allShots]
  );

  const handleSceneDragMove = useCallback(
    (sceneId: string, dx: number, dy: number) => {
      // Live synchronize position of member shots on canvas without React rerender
      const startMap = sceneMemberStartPositionsRef.current;
      if (startMap.size === 0) return;

      for (const [id, initial] of startMap.entries()) {
        const stage = stageRef.current;
        const shotNode = stage?.findOne(`#shot-${id}`);
        if (shotNode) {
          shotNode.x(Math.round(initial.x + dx));
          shotNode.y(Math.round(initial.y + dy));
        }
      }
    },
    []
  );

  const handleSceneDragEnd = useCallback(
    async (sceneId: string, newX: number, newY: number) => {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) return;

      const dx = newX - scene.x;
      const dy = newY - scene.y;

      // Persist scene position
      if (onUpdateScene) {
        await onUpdateScene(sceneId, { x: newX, y: newY });
      }

      // Compute and persist all member shot deltas
      if (onBatchUpdateShotPositions && dx !== 0 && dy !== 0) {
        const memberDeltas = calculateMemberShotsDelta(allShots, sceneId, dx, dy);
        if (memberDeltas.length > 0) {
          await onBatchUpdateShotPositions(memberDeltas);
        }
      }

      sceneMemberStartPositionsRef.current.clear();
    },
    [scenes, allShots, onUpdateScene, onBatchUpdateShotPositions]
  );

  const handleSceneResizeEnd = useCallback(
    async (sceneId: string, newWidth: number, newHeight: number) => {
      if (onUpdateScene) {
        await onUpdateScene(sceneId, {
          width: Math.max(SCENE_MIN_WIDTH, newWidth),
          height: Math.max(SCENE_MIN_HEIGHT, newHeight),
        });
      }
    },
    [onUpdateScene]
  );

  // --------------------------------------------------------------------------
  // SHOT DRAG HANDLERS (MULTI-SHOT & DELIBERATE HEADER DROP)
  // --------------------------------------------------------------------------

  const handleShotDragStart = useCallback(
    (shotId: string, startX: number, startY: number) => {
      // Ensure dragged shot is part of selection
      let activeSelection = selectedShotIds;
      if (!selectedShotIds.has(shotId)) {
        activeSelection = new Set([shotId]);
        setSelectedShotIds(activeSelection);
        setSelectedSceneId(null);
      }

      // Record start positions of all selected shots for multi-drag
      const startMap = new Map<string, { id: string; x: number; y: number }>();
      for (const id of activeSelection) {
        const shot = allShots.find((s) => s.id === id);
        if (shot) {
          startMap.set(id, { id, x: shot.x, y: shot.y });
        }
      }
      multiShotStartPositionsRef.current = startMap;
    },
    [selectedShotIds, allShots]
  );

  const handleShotDragMove = useCallback(
    (shotId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.currentTarget;
      const startMap = multiShotStartPositionsRef.current;
      const primaryInitial = startMap.get(shotId);

      if (primaryInitial && startMap.size > 1) {
        const dx = node.x() - primaryInitial.x;
        const dy = node.y() - primaryInitial.y;

        const stage = node.getStage();
        if (stage) {
          for (const [id, initial] of startMap.entries()) {
            if (id === shotId) continue;
            const otherNode = stage.findOne(`#shot-${id}`);
            if (otherNode) {
              otherNode.x(Math.round(initial.x + dx));
              otherNode.y(Math.round(initial.y + dy));
            }
          }
        }
      }

      // Check if dragged over any Scene Header (for deliberate reparenting)
      const stage = node.getStage();
      const pointer = stage?.getPointerPosition();
      if (pointer) {
        const worldPointer = stagePointToCanvas(pointer, viewport);
        let foundHeaderSceneId: string | null = null;

        for (const scene of scenes) {
          if (isPointOverSceneHeader(worldPointer, scene)) {
            foundHeaderSceneId = scene.id;
            break;
          }
        }

        setHeaderHoveredSceneId(foundHeaderSceneId);
      }
    },
    [viewport, scenes]
  );

  const handleShotDragEnd = useCallback(
    async (shotId: string, newX: number, newY: number) => {
      const targetHeaderSceneId = headerHoveredSceneId;
      setHeaderHoveredSceneId(null);

      const shot = allShots.find((s) => s.id === shotId);
      if (!shot) return;

      // 1. Deliberate Drop on Scene Header Reparenting
      if (
        targetHeaderSceneId &&
        targetHeaderSceneId !== shot.scene_id &&
        onReassignShotScene
      ) {
        await onReassignShotScene(shot.id, targetHeaderSceneId);
      }

      // 2. Persist Positions
      const startMap = multiShotStartPositionsRef.current;
      if (startMap.size > 1 && onBatchUpdateShotPositions) {
        const primaryInitial = startMap.get(shotId);
        if (primaryInitial) {
          const dx = newX - primaryInitial.x;
          const dy = newY - primaryInitial.y;

          const batchUpdates = Array.from(startMap.values()).map((s) => ({
            id: s.id,
            x: Math.round(s.x + dx),
            y: Math.round(s.y + dy),
          }));

          await onBatchUpdateShotPositions(batchUpdates);
        }
      } else if (onUpdateShot) {
        await onUpdateShot(shotId, { x: newX, y: newY });
      }

      multiShotStartPositionsRef.current.clear();
    },
    [
      headerHoveredSceneId,
      allShots,
      onReassignShotScene,
      onBatchUpdateShotPositions,
      onUpdateShot,
    ]
  );

  // --------------------------------------------------------------------------
  // STAGE MOUSE EVENTS (MARQUEE SELECTION & TOOL CREATION)
  // --------------------------------------------------------------------------

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // If user clicks on stage background directly with select tool -> initiate marquee
      const isLeftClick = e.evt.button === 0;
      if (!isLeftClick) return;

      const stage = e.target.getStage();
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldPos = stagePointToCanvas(pointer, viewport);

      // If tool is 'scene': create a scene at this position
      if (activeTool === 'scene' && onCreateScene && !readOnly) {
        onCreateScene(`Scene ${scenes.length + 1}`, '', worldPos.x, worldPos.y);
        setActiveTool('select');
        return;
      }

      // If tool is 'shot': create a shot inside target scene
      if (activeTool === 'shot' && onCreateShot && !readOnly) {
        const targetScene =
          selectedScene ||
          scenes.find(
            (s) =>
              worldPos.x >= s.x &&
              worldPos.x <= s.x + s.width &&
              worldPos.y >= s.y &&
              worldPos.y <= s.y + s.height
          ) ||
          scenes[0];

        if (targetScene) {
          onCreateShot(targetScene.id, {
            x: worldPos.x,
            y: worldPos.y,
          });
        }
        setActiveTool('select');
        return;
      }

      // If clicked on stage background, start marquee
      if (e.target === stage && activeTool === 'select') {
        isMarqueeActiveRef.current = true;
        marqueeStartPointRef.current = worldPos;
        setMarqueeBounds({
          x: worldPos.x,
          y: worldPos.y,
          width: 0,
          height: 0,
        });

        if (!e.evt.shiftKey && !e.evt.metaKey && !e.evt.ctrlKey) {
          handleClearSelection();
        }
      }
    },
    [
      activeTool,
      viewport,
      onCreateScene,
      onCreateShot,
      readOnly,
      scenes,
      selectedScene,
      handleClearSelection,
    ]
  );

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isMarqueeActiveRef.current || !marqueeStartPointRef.current) return;

      const stage = e.target.getStage();
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const worldPos = stagePointToCanvas(pointer, viewport);
      const start = marqueeStartPointRef.current;

      setMarqueeBounds({
        x: start.x,
        y: start.y,
        width: worldPos.x - start.x,
        height: worldPos.y - start.y,
      });
    },
    [viewport]
  );

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isMarqueeActiveRef.current && marqueeBounds) {
        isMarqueeActiveRef.current = false;
        marqueeStartPointRef.current = null;

        // Find intersecting shots
        const intersectingIds = findIntersectingShots(allShots, marqueeBounds);

        setSelectedShotIds((prev) => {
          if (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey) {
            const next = new Set(prev);
            for (const id of intersectingIds) next.add(id);
            return next;
          }
          return new Set(intersectingIds);
        });

        setMarqueeBounds(null);
      }
    },
    [marqueeBounds, allShots]
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (e.target === stage) {
        handleClearSelection();
      }
    },
    [handleClearSelection]
  );

  // --------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS (NUDGE, DUPLICATE, DELETE, DESELECT)
  // --------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Escape -> Deselect
      if (e.key === 'Escape') {
        handleClearSelection();
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedShotIds.size > 0 && onDuplicateShot && !readOnly) {
          for (const id of selectedShotIds) {
            onDuplicateShot(id);
          }
        }
        return;
      }

      // Delete / Backspace -> Delete selected shots or scene
      if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly) {
        if (selectedShotIds.size > 0 && onDeleteShot) {
          e.preventDefault();
          for (const id of selectedShotIds) {
            onDeleteShot(id);
          }
          setSelectedShotIds(new Set());
        } else if (selectedSceneId && onDeleteScene) {
          e.preventDefault();
          onDeleteScene(selectedSceneId);
          setSelectedSceneId(null);
        }
        return;
      }

      // Arrow Key Nudges: 1px or 10px with Shift
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;

        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        if (selectedShotIds.size > 0 && onBatchUpdateShotPositions && !readOnly) {
          const updates = Array.from(selectedShotIds)
            .map((id) => {
              const s = allShots.find((shot) => shot.id === id);
              return s ? { id, x: s.x + dx, y: s.y + dy } : null;
            })
            .filter((u): u is { id: string; x: number; y: number } => !!u);

          if (updates.length > 0) {
            onBatchUpdateShotPositions(updates);
          }
        } else if (selectedSceneId && onUpdateScene && !readOnly) {
          const scene = scenes.find((s) => s.id === selectedSceneId);
          if (scene) {
            onUpdateScene(selectedSceneId, {
              x: scene.x + dx,
              y: scene.y + dy,
            });
            if (onBatchUpdateShotPositions) {
              const memberDeltas = calculateMemberShotsDelta(allShots, selectedSceneId, dx, dy);
              if (memberDeltas.length > 0) {
                onBatchUpdateShotPositions(memberDeltas);
              }
            }
          }
        }
        return;
      }

      // Tool shortcuts (V, S, C, Z)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'v') setActiveTool('select');
        else if (key === 's') setActiveTool('shot');
        else if (key === 'c') setActiveTool('scene');
        else if (key === 'z' || (e.shiftKey && key === '!')) {
          handleZoomToFit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedShotIds,
    selectedSceneId,
    allShots,
    scenes,
    readOnly,
    handleClearSelection,
    onDuplicateShot,
    onDeleteShot,
    onDeleteScene,
    onBatchUpdateShotPositions,
    onUpdateScene,
    handleZoomToFit,
  ]);

  // --------------------------------------------------------------------------
  // CREATION BUTTON HELPERS
  // --------------------------------------------------------------------------

  const handleCreateSceneAtSensibleLocation = useCallback(async () => {
    if (!onCreateScene || readOnly) return;
    const pos = calculateNextScenePosition(scenes, viewport);
    const newScene = await onCreateScene(
      `Scene ${scenes.length + 1}`,
      '',
      pos.x,
      pos.y
    );
    if (newScene) {
      setSelectedSceneId(newScene.id);
      setSelectedShotIds(new Set());
    }
  }, [onCreateScene, readOnly, scenes, viewport]);

  const handleCreateShotInTargetScene = useCallback(
    async (sceneId?: string) => {
      if (!onCreateShot || readOnly) return;
      const targetScene =
        (sceneId && scenes.find((s) => s.id === sceneId)) ||
        selectedScene ||
        scenes[0];

      if (!targetScene) {
        await handleCreateSceneAtSensibleLocation();
        return;
      }

      const pos = calculateNextShotPosition(targetScene, targetScene.shots);
      const newShot = await onCreateShot(targetScene.id, {
        x: pos.x,
        y: pos.y,
      });

      if (newShot) {
        setSelectedSceneId(null);
        setSelectedShotIds(new Set([newShot.id]));
      }
    },
    [
      onCreateShot,
      readOnly,
      scenes,
      selectedScene,
      handleCreateSceneAtSensibleLocation,
    ]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex-1 relative overflow-hidden bg-background select-none"
    >
      {/* Floating Canvas HUD Toolbar */}
      <StoryboardToolbar
        activeTool={activeTool}
        onChangeActiveTool={setActiveTool}
        viewport={viewport}
        onViewportChange={handleViewportChange}
        onZoomToFit={handleZoomToFit}
        readOnly={readOnly}
      />

      {/* Main Konva Viewport Stage */}
      <StoryboardStage
        stageRef={stageRef}
        viewport={viewport}
        onViewportChange={handleViewportChange}
        activeTool={activeTool}
        containerWidth={dimensions.width}
        containerHeight={dimensions.height}
        readOnly={readOnly}
        marqueeBounds={marqueeBounds}
        onStageMouseDown={handleStageMouseDown}
        onStageMouseMove={handleStageMouseMove}
        onStageMouseUp={handleStageMouseUp}
        onStageClick={handleStageClick}
      >
        {/* Layer 1: Scene Territories */}
        {scenes.map((scene) => (
          <SceneRegionNode
            key={scene.id}
            scene={scene}
            isSelected={selectedSceneId === scene.id}
            isHeaderHovered={headerHoveredSceneId === scene.id}
            readOnly={readOnly}
            onSelect={handleSelectScene}
            onDragStart={handleSceneDragStart}
            onDragMove={handleSceneDragMove}
            onDragEnd={handleSceneDragEnd}
            onResizeEnd={handleSceneResizeEnd}
            onEditScene={(s) => {
              setSelectedShotIds(new Set());
              setSelectedSceneId(s.id);
            }}
          />
        ))}

        {/* Layer 2: Shot Cards */}
        {allShots.map((shot) => (
          <ShotCardNode
            key={shot.id}
            shot={shot}
            isSelected={selectedShotIds.has(shot.id) && selectedShotIds.size === 1}
            isMultiSelected={selectedShotIds.has(shot.id) && selectedShotIds.size > 1}
            readOnly={readOnly}
            onSelect={handleSelectShot}
            onDragStart={handleShotDragStart}
            onDragMove={handleShotDragMove}
            onDragEnd={handleShotDragEnd}
            onDoubleClick={(s) => {
              setSelectedSceneId(null);
              setSelectedShotIds(new Set([s.id]));
            }}
          />
        ))}

        {children}
      </StoryboardStage>

      {/* Floating Shot Inspector (when a single shot is selected) */}
      {selectedShot && !selectedSceneId && (
        <StoryboardShotInspector
          shot={selectedShot}
          scenes={scenes}
          readOnly={readOnly}
          onClose={() => setSelectedShotIds(new Set())}
          onUpdateShot={async (id, updates) => {
            if (onUpdateShot) await onUpdateShot(id, updates);
          }}
          onReassignScene={async (shotId, targetSceneId) => {
            if (onReassignShotScene) await onReassignShotScene(shotId, targetSceneId);
          }}
          onDuplicateShot={async (id) => {
            if (onDuplicateShot) await onDuplicateShot(id);
          }}
          onDeleteShot={async (id) => {
            if (onDeleteShot) {
              await onDeleteShot(id);
              setSelectedShotIds(new Set());
            }
          }}
        />
      )}

      {/* Floating Scene Inspector (when a scene is selected) */}
      {selectedScene && selectedShotIds.size === 0 && (
        <StoryboardSceneInspector
          scene={selectedScene}
          readOnly={readOnly}
          onClose={() => setSelectedSceneId(null)}
          onUpdateScene={async (id, updates) => {
            if (onUpdateScene) await onUpdateScene(id, updates);
          }}
          onDeleteScene={async (id) => {
            if (onDeleteScene) {
              await onDeleteScene(id);
              setSelectedSceneId(null);
            }
          }}
          onAddShotToScene={async (sceneId) => {
            await handleCreateShotInTargetScene(sceneId);
          }}
        />
      )}
    </div>
  );
}
