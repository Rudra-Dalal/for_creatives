'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { Group, Rect, Image as KonvaImage, Text } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { MoodboardItem, ImageItemContent } from '../types';
import { getCanvasSafeImageUrl } from '../utils/canvasImageUtils';

interface CanvasImageItemProps {
  item: MoodboardItem;
  isSelected: boolean;
  onSelect: (node: Konva.Node) => void;
  onPointerDown?: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onDimensionsCorrected?: (id: string, width: number, height: number) => void;
  isDraggable?: boolean;
  shareToken?: string;
}

export function CanvasImageItem({
  item,
  isSelected,
  onSelect,
  onPointerDown,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDimensionsCorrected,
  isDraggable = true,
  shareToken,
}: CanvasImageItemProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const correctedRef = useRef(false);

  const content = (item.content as ImageItemContent) || {};
  const rawImageUrl = content.imageUrl || '';
  const imageUrl = useMemo(
    () => getCanvasSafeImageUrl(rawImageUrl, shareToken),
    [rawImageUrl, shareToken]
  );
  const fileName = content.fileName || 'Image';

  const [image, imageStatus] = useImage(imageUrl, 'anonymous');

  useEffect(() => {
    if (correctedRef.current) return;
    const naturalW = image && image.width > 0 ? image.width : content.originalWidth;
    const naturalH = image && image.height > 0 ? image.height : content.originalHeight;
    if (naturalW && naturalH && naturalW > 0 && naturalH > 0) {
      const naturalRatio = naturalH / naturalW;
      const currentRatio = item.height / item.width;
      if (Math.abs(currentRatio - naturalRatio) > 0.03) {
        correctedRef.current = true;
        const correctHeight = Math.max(40, Math.round(item.width * naturalRatio));
        if (groupRef.current) {
          groupRef.current.height(correctHeight);
        }
        onDimensionsCorrected?.(item.id, item.width, correctHeight);
      }
    }
  }, [
    imageStatus,
    image,
    content.originalWidth,
    content.originalHeight,
    item.id,
    item.width,
    item.height,
    onDimensionsCorrected,
  ]);

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
    let newHeight = Math.max(40, Math.round(node.height() * scaleY));

    const naturalW = image && image.width > 0 ? image.width : content.originalWidth;
    const naturalH = image && image.height > 0 ? image.height : content.originalHeight;

    if (naturalW && naturalH && naturalW > 0 && naturalH > 0) {
      const naturalRatio = naturalH / naturalW;
      newHeight = Math.max(40, Math.round(newWidth * naturalRatio));
    }

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
      name="moodboard-item"
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable={isDraggable}
      onMouseDown={(e) => {
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        if (groupRef.current) {
          if (onPointerDown) onPointerDown(groupRef.current);
          else onSelect(groupRef.current);
        }
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        if (groupRef.current) {
          if (onPointerDown) onPointerDown(groupRef.current);
          else onSelect(groupRef.current);
        }
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
