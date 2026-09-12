'use client';

import React, { useRef, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { StoryboardSceneWithShots } from '../types';
import { SCENE_HEADER_HEIGHT, SCENE_MIN_WIDTH, SCENE_MIN_HEIGHT } from '../utils/storyboardGeometry';

export interface SceneRegionNodeProps {
  scene: StoryboardSceneWithShots;
  isSelected: boolean;
  isHeaderHovered?: boolean;
  readOnly?: boolean;
  onSelect: (sceneId: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart: (sceneId: string, startX: number, startY: number) => void;
  onDragMove: (sceneId: string, dx: number, dy: number) => void;
  onDragEnd: (sceneId: string, newX: number, newY: number) => void;
  onResizeEnd: (sceneId: string, newWidth: number, newHeight: number) => void;
  onEditScene?: (scene: StoryboardSceneWithShots) => void;
}

export function SceneRegionNode({
  scene,
  isSelected,
  isHeaderHovered = false,
  readOnly = false,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResizeEnd,
  onEditScene,
}: SceneRegionNodeProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const dragAllowedRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: scene.x, y: scene.y });

  const [isResizing, setIsResizing] = useState<boolean>(false);
  const resizeHandleRef = useRef<Konva.Rect | null>(null);

  const sceneNumber = `SCENE ${String(scene.display_order + 1).padStart(2, '0')}`;
  const shotsCount = `${scene.shots.length} ${scene.shots.length === 1 ? 'shot' : 'shots'}`;

  // Drag start handler - only allow dragging if initiated on header
  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (!dragAllowedRef.current) {
      groupRef.current?.stopDrag();
      return;
    }
    dragStartPosRef.current = { x: scene.x, y: scene.y };
    onDragStart(scene.id, scene.x, scene.y);
  };

  // Drag move handler - calculate delta from initial position and notify parent for member shots sync
  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = groupRef.current;
    if (!node) return;
    const dx = node.x() - dragStartPosRef.current.x;
    const dy = node.y() - dragStartPosRef.current.y;
    onDragMove(scene.id, dx, dy);
  };

  // Drag end handler - commit final position
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = groupRef.current;
    dragAllowedRef.current = false;
    if (!node) return;
    const newX = Math.round(node.x());
    const newY = Math.round(node.y());
    onDragEnd(scene.id, newX, newY);
  };

  // Resize Handle Drag
  const handleResizeStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    setIsResizing(true);
  };

  const handleResizeMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const handle = resizeHandleRef.current;
    if (!handle) return;
    // Keep handle position within minimum constraints
    const currentW = Math.max(SCENE_MIN_WIDTH, handle.x());
    const currentH = Math.max(SCENE_MIN_HEIGHT, handle.y());
    handle.x(currentW);
    handle.y(currentH);
  };

  const handleResizeEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    setIsResizing(false);
    const handle = resizeHandleRef.current;
    if (!handle) return;
    const finalW = Math.max(SCENE_MIN_WIDTH, Math.round(handle.x()));
    const finalH = Math.max(SCENE_MIN_HEIGHT, Math.round(handle.y()));
    onResizeEnd(scene.id, finalW, finalH);
  };

  const cornerRadius = 8;
  const headerHeight = SCENE_HEADER_HEIGHT;

  return (
    <Group
      ref={groupRef}
      id={`scene-${scene.id}`}
      name="storyboard-scene"
      x={scene.x}
      y={scene.y}
      width={scene.width}
      height={scene.height}
      draggable={!readOnly}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        if (e.evt.button === 0) {
          onSelect(scene.id, e);
        }
      }}
    >
      {/* 1. Territory Background & Subtle Outer Boundary */}
      <Rect
        x={0}
        y={0}
        width={scene.width}
        height={scene.height}
        fill="rgba(24, 23, 20, 0.4)"
        stroke={isSelected ? '#D97706' : '#2A2823'}
        strokeWidth={isSelected ? 1.5 : 1}
        dash={isSelected ? undefined : [4, 4]}
        cornerRadius={cornerRadius}
        onMouseDown={() => {
          // Clicking body does NOT allow dragging the scene (allows marquee or shot interaction)
          dragAllowedRef.current = false;
        }}
      />

      {/* 2. Scene Header Bar (Dedicated Drag & Drop Handle) */}
      <Group
        x={0}
        y={0}
        onMouseEnter={() => {
          if (typeof window !== 'undefined') {
            document.body.style.cursor = 'grab';
          }
        }}
        onMouseLeave={() => {
          if (typeof window !== 'undefined') {
            document.body.style.cursor = 'default';
          }
        }}
        onMouseDown={(e) => {
          if (e.evt.button === 0 && !readOnly) {
            dragAllowedRef.current = true;
          }
        }}
        onDblClick={(e) => {
          e.cancelBubble = true;
          if (onEditScene) onEditScene(scene);
        }}
      >
        {/* Header background */}
        <Rect
          x={0}
          y={0}
          width={scene.width}
          height={headerHeight}
          fill={isHeaderHovered ? 'rgba(217, 119, 6, 0.2)' : '#191815'}
          stroke={isHeaderHovered ? '#D97706' : isSelected ? '#D97706' : '#2A2823'}
          strokeWidth={isHeaderHovered ? 2 : isSelected ? 1.5 : 1}
          cornerRadius={[cornerRadius, cornerRadius, 0, 0]}
        />

        {/* Scene Number Pill */}
        <Group x={12} y={11}>
          <Rect
            x={0}
            y={0}
            width={72}
            height={22}
            fill="#23211C"
            stroke="#36332C"
            strokeWidth={1}
            cornerRadius={4}
          />
          <Text
            x={0}
            y={5}
            width={72}
            align="center"
            text={sceneNumber}
            fontFamily="monospace"
            fontSize={10}
            fontStyle="bold"
            fill="#D97706"
            letterSpacing={0.5}
            listening={false}
          />
        </Group>

        {/* Scene Title */}
        <Text
          x={94}
          y={14}
          width={scene.width - 200}
          text={scene.title || 'Untitled Scene'}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={13}
          fontStyle="bold"
          fill="#EDEDEC"
          ellipsis={true}
          listening={false}
        />

        {/* Shots Counter Badge */}
        <Text
          x={scene.width - 96}
          y={15}
          width={84}
          align="right"
          text={shotsCount}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={11}
          fill="#8E8B82"
          listening={false}
        />
      </Group>

      {/* 3. Optional Description banner if present */}
      {scene.description && (
        <Text
          x={14}
          y={headerHeight + 8}
          width={scene.width - 28}
          text={scene.description}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={11}
          fill="#737067"
          fontStyle="italic"
          ellipsis={true}
          listening={false}
        />
      )}

      {/* 4. Bottom-Right Resize Handle */}
      {!readOnly && (
        <Rect
          ref={resizeHandleRef}
          x={scene.width}
          y={scene.height}
          width={14}
          height={14}
          offsetX={7}
          offsetY={7}
          fill={isResizing ? '#D97706' : '#2A2823'}
          stroke="#36332C"
          strokeWidth={1}
          cornerRadius={2}
          draggable={true}
          onMouseEnter={() => {
            if (typeof window !== 'undefined') {
              document.body.style.cursor = 'nwse-resize';
            }
          }}
          onMouseLeave={() => {
            if (typeof window !== 'undefined') {
              document.body.style.cursor = 'default';
            }
          }}
          onDragStart={handleResizeStart}
          onDragMove={handleResizeMove}
          onDragEnd={handleResizeEnd}
        />
      )}
    </Group>
  );
}
