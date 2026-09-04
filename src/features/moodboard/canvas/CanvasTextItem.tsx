'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem, TextItemContent } from '../types';

interface CanvasTextItemProps {
  item: MoodboardItem;
  isSelected: boolean;
  onSelect: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onDoubleClick: (item: MoodboardItem) => void;
  isDraggable?: boolean;
}

export function CanvasTextItem({
  item,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
  isDraggable = true,
}: CanvasTextItemProps) {
  const groupRef = useRef<Konva.Group | null>(null);

  const content = (item.content as TextItemContent) || { text: 'Creative Note' };
  const text = content.text || 'Add thought...';


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

    const newWidth = Math.max(120, Math.round(node.width() * scaleX));
    const newHeight = Math.max(80, Math.round(node.height() * scaleY));

    node.width(newWidth);
    node.height(newHeight);

    onTransformEnd(item.id, node.x(), node.y(), newWidth, newHeight);
  };

  const cornerRadius = 6;
  const padding = 16;

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
      onDblClick={() => onDoubleClick(item)}
      onDblTap={() => onDoubleClick(item)}
      onDragStart={() => {
        if (groupRef.current) onSelect(groupRef.current);
        onDragStart();
      }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {/* Background card */}
      <Rect
        width={item.width}
        height={item.height}
        fill="#22211e"
        stroke={isSelected ? '#f59e0b' : '#383630'}
        strokeWidth={isSelected ? 1.5 : 1}
        cornerRadius={cornerRadius}
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.3}
        shadowOffset={{ x: 0, y: 3 }}
      />

      {/* Top note header line */}
      <Rect
        x={padding}
        y={padding}
        width={24}
        height={2}
        fill="#f59e0b"
        cornerRadius={1}
      />

      {/* Text body */}
      <Text
        text={text}
        x={padding}
        y={padding + 10}
        width={item.width - padding * 2}
        height={item.height - padding * 2 - 10}
        fill="#f0ede6"
        fontSize={content.fontSize || 14}
        fontFamily={content.fontFamily || 'Newsreader, Georgia, serif'}
        lineHeight={1.4}
        wrap="word"
        ellipsis
      />
    </Group>
  );
}
