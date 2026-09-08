'use client';

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem, TextItemContent } from '../../types';

export interface TextCardProps {
  item: MoodboardItem;
  isSelected: boolean;
  isDraggable: boolean;
  onPointerDown: (node: Konva.Node) => void;
  onSelect: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onDoubleClick: (item: MoodboardItem) => void;
}

export function TextCard({
  item,
  isSelected,
  isDraggable,
  onPointerDown,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
}: TextCardProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const content = (item.content as TextItemContent) || { text: 'Creative Note' };
  const text = content.text || 'Add thought...';

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = groupRef.current ?? (e.currentTarget as Konva.Node);
    if (!node) return;
    onDragEnd(item.id, node.x(), node.y());
  };

  const handleTransformEnd = () => {
    if (!groupRef.current) return;
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const nw = Math.max(120, Math.round(node.width() * scaleX));
    const nh = Math.max(80, Math.round(node.height() * scaleY));
    node.width(nw);
    node.height(nh);
    onTransformEnd(item.id, node.x(), node.y(), nw, nh);
  };

  const cr = 6;
  const pad = 16;

  return (
    <Group
      ref={groupRef}
      id={item.id}
      name="moodboard-item"
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable={isDraggable}
      onMouseDown={(e) => {
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        if (groupRef.current) onPointerDown(groupRef.current);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        if (groupRef.current) onPointerDown(groupRef.current);
      }}
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
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        width={item.width}
        height={item.height}
        fill="#1e1e1b"
        stroke={isSelected ? '#d97706' : '#2e2e2a'}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={cr}
        shadowColor={isSelected ? '#d97706' : 'black'}
        shadowBlur={isSelected ? 16 : 10}
        shadowOpacity={isSelected ? 0.35 : 0.3}
        shadowOffset={{ x: 0, y: 3 }}
      />
      <Rect x={pad} y={pad} width={24} height={2} fill="#f59e0b" cornerRadius={1} />
      <Text
        text={text}
        x={pad}
        y={pad + 10}
        width={item.width - pad * 2}
        height={item.height - pad * 2 - 10}
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
