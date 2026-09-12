'use client';

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { StoryboardShotWithLinks } from '../types';
import { calculateShotDimensions } from '../utils/storyboardGeometry';

export interface ShotCardNodeProps {
  shot: StoryboardShotWithLinks;
  isSelected: boolean;
  isMultiSelected?: boolean;
  readOnly?: boolean;
  onSelect: (shotId: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart: (shotId: string, startX: number, startY: number) => void;
  onDragMove: (shotId: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (shotId: string, newX: number, newY: number) => void;
  onDoubleClick?: (shot: StoryboardShotWithLinks) => void;
}

export function ShotCardNode({
  shot,
  isSelected,
  isMultiSelected = false,
  readOnly = false,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick,
}: ShotCardNodeProps) {
  const groupRef = useRef<Konva.Group | null>(null);

  const cardWidth = shot.width || 280;
  const { frameHeight, totalHeight } = calculateShotDimensions(shot.aspect_ratio, cardWidth);

  const shotNumber = shot.shot_number || String(shot.display_order + 1);
  const shotLabel = `SHOT ${shotNumber.padStart(2, '0')}`;
  const aspectRatioLabel = shot.aspect_ratio || '16:9';

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragStart(shot.id, shot.x, shot.y);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragMove(shot.id, e);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = groupRef.current;
    if (!node) return;
    const newX = Math.round(node.x());
    const newY = Math.round(node.y());
    onDragEnd(shot.id, newX, newY);
  };

  const cornerRadius = 8;
  const isHighlighted = isSelected || isMultiSelected;

  return (
    <Group
      ref={groupRef}
      id={`shot-${shot.id}`}
      name="storyboard-shot"
      x={shot.x}
      y={shot.y}
      width={cardWidth}
      height={totalHeight}
      draggable={!readOnly}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        if (e.evt.button === 0) {
          e.cancelBubble = true;
          onSelect(shot.id, e);
        }
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        if (onDoubleClick) onDoubleClick(shot);
      }}
      onMouseEnter={() => {
        if (typeof window !== 'undefined' && !readOnly) {
          document.body.style.cursor = 'grab';
        }
      }}
      onMouseLeave={() => {
        if (typeof window !== 'undefined') {
          document.body.style.cursor = 'default';
        }
      }}
    >
      {/* 1. Outer Card Container with Elevation & Border */}
      <Rect
        x={0}
        y={0}
        width={cardWidth}
        height={totalHeight}
        fill="#181714"
        stroke={isHighlighted ? '#D97706' : '#2C2A24'}
        strokeWidth={isHighlighted ? 1.5 : 1}
        cornerRadius={cornerRadius}
        shadowColor="rgba(0, 0, 0, 0.5)"
        shadowBlur={isHighlighted ? 16 : 8}
        shadowOffset={{ x: 0, y: isHighlighted ? 4 : 2 }}
        shadowOpacity={0.6}
      />

      {/* 2. Dominant Visual Frame Placeholder */}
      <Group x={6} y={6}>
        <Rect
          x={0}
          y={0}
          width={cardWidth - 12}
          height={frameHeight}
          fill="#11100E"
          stroke="#26241F"
          strokeWidth={1}
          cornerRadius={5}
        />

        {/* Framing Crosshair or Center Quiet Mark */}
        <Rect
          x={(cardWidth - 12) / 2 - 12}
          y={frameHeight / 2 - 12}
          width={24}
          height={24}
          stroke="#2F2D27"
          strokeWidth={1}
          cornerRadius={3}
          listening={false}
        />
        <Text
          x={0}
          y={frameHeight / 2 + 18}
          width={cardWidth - 12}
          align="center"
          text="Empty Frame"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={10}
          fill="#524F47"
          listening={false}
        />

        {/* Frame Overlay: Top-Left Shot Number Pill */}
        <Group x={8} y={8}>
          <Rect
            x={0}
            y={0}
            width={60}
            height={20}
            fill="rgba(18, 17, 14, 0.85)"
            stroke="#38352C"
            strokeWidth={1}
            cornerRadius={3}
          />
          <Text
            x={0}
            y={4}
            width={60}
            align="center"
            text={shotLabel}
            fontFamily="monospace"
            fontSize={9}
            fontStyle="bold"
            fill="#D97706"
            letterSpacing={0.5}
            listening={false}
          />
        </Group>

        {/* Frame Overlay: Top-Right Aspect Ratio Badge */}
        <Group x={cardWidth - 12 - 46} y={8}>
          <Rect
            x={0}
            y={0}
            width={38}
            height={20}
            fill="rgba(18, 17, 14, 0.85)"
            stroke="#38352C"
            strokeWidth={1}
            cornerRadius={3}
          />
          <Text
            x={0}
            y={4}
            width={38}
            align="center"
            text={aspectRatioLabel}
            fontFamily="monospace"
            fontSize={9}
            fill="#A6A29A"
            listening={false}
          />
        </Group>
      </Group>

      {/* 3. Secondary Info Section (Title & Description) */}
      <Group x={12} y={frameHeight + 14}>
        {/* Title */}
        <Text
          x={0}
          y={0}
          width={cardWidth - 24}
          text={shot.title || 'Untitled Shot'}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={13}
          fontStyle="bold"
          fill="#EDEDEC"
          ellipsis={true}
          listening={false}
        />

        {/* Short Description */}
        <Text
          x={0}
          y={20}
          width={cardWidth - 24}
          text={shot.description || 'No description added'}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={11}
          fill={shot.description ? '#9C988F' : '#524F47'}
          fontStyle={shot.description ? 'normal' : 'italic'}
          ellipsis={true}
          listening={false}
        />

        {/* 4. Metadata Badges (Shot Type & Camera Movement) */}
        <Group x={0} y={42}>
          {shot.shot_type && (
            <Group x={0} y={0}>
              <Rect
                x={0}
                y={0}
                width={Math.max(48, shot.shot_type.length * 7 + 14)}
                height={18}
                fill="#22201B"
                stroke="#333028"
                strokeWidth={1}
                cornerRadius={3}
              />
              <Text
                x={6}
                y={3.5}
                text={shot.shot_type.toUpperCase()}
                fontFamily="monospace"
                fontSize={8.5}
                fill="#B8B4AA"
                letterSpacing={0.5}
                listening={false}
              />
            </Group>
          )}

          {shot.camera_movement && (
            <Group x={shot.shot_type ? Math.max(48, shot.shot_type.length * 7 + 14) + 6 : 0} y={0}>
              <Rect
                x={0}
                y={0}
                width={Math.max(48, shot.camera_movement.length * 7 + 14)}
                height={18}
                fill="#22201B"
                stroke="#333028"
                strokeWidth={1}
                cornerRadius={3}
              />
              <Text
                x={6}
                y={3.5}
                text={shot.camera_movement.toUpperCase()}
                fontFamily="monospace"
                fontSize={8.5}
                fill="#8E8A80"
                letterSpacing={0.5}
                listening={false}
              />
            </Group>
          )}
        </Group>
      </Group>
    </Group>
  );
}
