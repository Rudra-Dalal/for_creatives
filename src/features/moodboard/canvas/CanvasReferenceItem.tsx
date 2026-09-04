'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Rect, Image as KonvaImage, Text } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { MoodboardItem, ReferenceItemContent } from '../types';

interface CanvasReferenceItemProps {
  item: MoodboardItem;
  isSelected: boolean;
  onSelect: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  isDraggable?: boolean;
}

export function CanvasReferenceItem({
  item,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  isDraggable = true,
}: CanvasReferenceItemProps) {
  const groupRef = useRef<Konva.Group | null>(null);

  const content = (item.content as ReferenceItemContent) || {};
  const imageUrl = item.reference?.thumbnail_url || content.thumbnail_url || '';
  const title = item.reference?.title || content.title || 'Reference';
  const domain = item.reference?.source_domain || content.source_domain || '';

  const [image, imageStatus] = useImage(imageUrl, 'anonymous');


  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(item.id, node.x(), node.y());
  };

  const handleTransformEnd = () => {
    if (!groupRef.current) return;
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale to 1 and adjust width & height to avoid distorted rendering
    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(80, Math.round(node.width() * scaleX));
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
        stroke={isSelected ? '#f59e0b' : '#2a2a26'}
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
            fill="#1f1e1a"
            cornerRadius={cornerRadius - 1}
          />
          <Text
            text={title}
            x={16}
            y={item.height / 2 - 12}
            width={item.width - 32}
            fill="#e6e4df"
            fontSize={13}
            fontFamily="Inter"
            align="center"
            ellipsis
          />
          {domain && (
            <Text
              text={domain}
              x={16}
              y={item.height / 2 + 10}
              width={item.width - 32}
              fill="#8c8a82"
              fontSize={10}
              fontFamily="monospace"
              align="center"
              ellipsis
            />
          )}
        </Group>
      )}

      {/* Subtle Domain Tag Overlay on bottom left */}
      {domain && (
        <Group x={6} y={item.height - 22}>
          <Rect
            width={Math.min(domain.length * 6 + 12, item.width - 12)}
            height={16}
            fill="rgba(0, 0, 0, 0.75)"
            cornerRadius={3}
          />
          <Text
            text={domain}
            x={6}
            y={3}
            fill="#e6e4df"
            fontSize={9}
            fontFamily="monospace"
            ellipsis
            width={item.width - 24}
          />
        </Group>
      )}
    </Group>
  );
}
