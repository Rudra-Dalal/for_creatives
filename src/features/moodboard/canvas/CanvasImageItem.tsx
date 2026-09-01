'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Rect, Image as KonvaImage, Text } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { MoodboardItem, ImageItemContent } from '../types';

interface CanvasImageItemProps {
  item: MoodboardItem;
  isSelected: boolean;
  onSelect: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
}

export function CanvasImageItem({
  item,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
}: CanvasImageItemProps) {
  const groupRef = useRef<Konva.Group | null>(null);

  const content = (item.content as ImageItemContent) || {};
  const imageUrl = content.imageUrl || '';
  const fileName = content.fileName || 'Image';

  const [image, imageStatus] = useImage(imageUrl, 'anonymous');

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

    const newWidth = Math.max(60, Math.round(node.width() * scaleX));
    const newHeight = Math.max(60, Math.round(node.height() * scaleY));

    node.width(newWidth);
    node.height(newHeight);

    onTransformEnd(item.id, node.x(), node.y(), newWidth, newHeight);
  };

  const cornerRadius = 6;
  const isImageLoaded = imageStatus === 'loaded' && image;

  return (
    <Group
      ref={groupRef}
      id={item.id}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable
      onClick={(e) => {
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        if (groupRef.current) onSelect(groupRef.current);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (groupRef.current) onSelect(groupRef.current);
      }}
      onDragStart={() => {
        if (groupRef.current) onSelect(groupRef.current);
        onDragStart();
      }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {/* Background card with shadow */}
      <Rect
        width={item.width}
        height={item.height}
        fill="#181816"
        stroke={isSelected ? '#D97706' : '#2A2A26'}
        strokeWidth={isSelected ? 1.5 : 1}
        cornerRadius={cornerRadius}
        shadowColor="black"
        shadowBlur={12}
        shadowOpacity={0.4}
        shadowOffset={{ x: 0, y: 4 }}
      />

      {/* Render Image or Fallback */}
      {isImageLoaded ? (
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.roundRect(1, 1, item.width - 2, item.height - 2, cornerRadius - 1);
            ctx.closePath();
          }}
        >
          <KonvaImage
            image={image}
            x={0}
            y={0}
            width={item.width}
            height={item.height}
          />
        </Group>
      ) : (
        <Group>
          <Rect
            x={1}
            y={1}
            width={item.width - 2}
            height={item.height - 2}
            fill="#1F1E1A"
            cornerRadius={cornerRadius - 1}
          />
          <Text
            text={fileName}
            x={16}
            y={item.height / 2 - 8}
            width={item.width - 32}
            fill="#EDEDEC"
            fontSize={12}
            fontFamily="Inter"
            align="center"
            ellipsis
          />
        </Group>
      )}
    </Group>
  );
}
