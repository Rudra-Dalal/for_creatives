'use client';

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem, IdeaItemContent } from '../../types';

export interface IdeaCardProps {
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

export function IdeaCard({
  item,
  isSelected,
  isDraggable,
  onPointerDown,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
}: IdeaCardProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const content = (item.content as IdeaItemContent) || {};
  const title = content.title || 'Creative Idea';
  const notes = content.notes || '';

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd(item.id, e.target.x(), e.target.y());
  };

  const handleTransformEnd = () => {
    if (!groupRef.current) return;
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const nw = Math.max(140, Math.round(node.width() * scaleX));
    const nh = Math.max(100, Math.round(node.height() * scaleY));
    node.width(nw);
    node.height(nh);
    onTransformEnd(item.id, node.x(), node.y(), nw, nh);
  };

  const cr = 8;

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
      onDblClick={(e) => { e.cancelBubble = true; onDoubleClick(item); }}
      onDblTap={(e) => { e.cancelBubble = true; onDoubleClick(item); }}
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        width={item.width}
        height={item.height}
        fill="#1C1B17"
        stroke={isSelected ? '#D97706' : '#333129'}
        strokeWidth={isSelected ? 1.5 : 1}
        cornerRadius={cr}
        shadowColor="black"
        shadowBlur={14}
        shadowOpacity={0.45}
        shadowOffset={{ x: 0, y: 4 }}
      />
      <Rect x={1} y={1} width={item.width - 2} height={3} fill="#D97706" cornerRadius={[cr - 1, cr - 1, 0, 0]} />
      <Group x={14} y={12}>
        <Rect width={38} height={15} fill="rgba(217,119,6,0.15)" cornerRadius={3} />
        <Text text="IDEA" x={6} y={3} fill="#D97706" fontSize={8} fontFamily="monospace" fontStyle="bold" />
      </Group>
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
