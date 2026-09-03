'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem, IdeaItemContent } from '../types';

interface CanvasIdeaItemProps {
  item: MoodboardItem;
  isSelected: boolean;
  onSelect: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onDoubleClick: (item: MoodboardItem) => void;
  isDraggable?: boolean;
}

export function CanvasIdeaItem({
  item,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
  isDraggable = true,
}: CanvasIdeaItemProps) {
  const groupRef = useRef<Konva.Group | null>(null);

  const content = (item.content as IdeaItemContent) || {};
  const title = content.title || 'Creative Idea';
  const notes = content.notes || '';

  useEffect(() => {
    if (isSelected && groupRef.current) {
      onSelect(groupRef.current);
    }
  }, [isSelected, onSelect]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(item.id, node.x(), node.y());
  };

  const handleTransformEnd = () => {
    if (!groupRef.current) return;
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(140, Math.round(node.width() * scaleX));
    const newHeight = Math.max(100, Math.round(node.height() * scaleY));

    node.width(newWidth);
    node.height(newHeight);

    onTransformEnd(item.id, node.x(), node.y(), newWidth, newHeight);
  };

  const cornerRadius = 8;

  return (
    <Group
      ref={groupRef}
      id={item.id}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable={isDraggable}
      onClick={(e) => {
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        if (groupRef.current) onSelect(groupRef.current);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (groupRef.current) onSelect(groupRef.current);
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        onDoubleClick(item);
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        onDoubleClick(item);
      }}
      onDragStart={() => {
        if (groupRef.current) onSelect(groupRef.current);
        onDragStart();
      }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {/* Background card with subtle amber-tinted dark surface */}
      <Rect
        width={item.width}
        height={item.height}
        fill="#1C1B17"
        stroke={isSelected ? '#D97706' : '#333129'}
        strokeWidth={isSelected ? 1.5 : 1}
        cornerRadius={cornerRadius}
        shadowColor="black"
        shadowBlur={14}
        shadowOpacity={0.45}
        shadowOffset={{ x: 0, y: 4 }}
      />

      {/* Top Accent Indicator */}
      <Rect
        x={1}
        y={1}
        width={item.width - 2}
        height={3}
        fill="#D97706"
        cornerRadius={[cornerRadius - 1, cornerRadius - 1, 0, 0]}
      />

      {/* Idea Label Pill */}
      <Group x={14} y={12}>
        <Rect
          width={38}
          height={15}
          fill="rgba(217, 119, 6, 0.15)"
          cornerRadius={3}
        />
        <Text
          text="IDEA"
          x={6}
          y={3}
          fill="#D97706"
          fontSize={8}
          fontFamily="monospace"
          fontStyle="bold"
        />
      </Group>

      {/* Idea Title (Editorial Serif) */}
      <Text
        text={title}
        x={14}
        y={34}
        width={item.width - 28}
        fill="#EDEDEC"
        fontSize={15}
        fontFamily="Newsreader"
        fontStyle="italic"
        lineHeight={1.35}
        wrap="word"
        ellipsis
      />

      {/* Optional Idea Sub-notes */}
      {notes && (
        <Text
          text={notes}
          x={14}
          y={Math.min(item.height - 30, 80)}
          width={item.width - 28}
          fill="#989890"
          fontSize={11}
          fontFamily="Inter"
          lineHeight={1.4}
          wrap="word"
          ellipsis
        />
      )}
    </Group>
  );
}
