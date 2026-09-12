'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { Group, Rect, Image as KonvaImage, Text, Path } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { MoodboardItem, ReferenceItemContent } from '../../types';
import { getCanvasSafeImageUrl } from '../../utils/canvasImageUtils';
import { clampAspectDimensions } from '../canvasItemPure';

export interface ReferenceCardProps {
  item: MoodboardItem;
  isSelected: boolean;
  isDraggable: boolean;
  linkedDirectionsCount?: number;
  shareToken?: string;
  onPointerDown: (node: Konva.Node) => void;
  onSelect: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onDimensionsCorrected?: (id: string, width: number, height: number) => void;
  onInspectDirection?: (referenceId: string) => void;
}

export function ReferenceCard({
  item,
  isSelected,
  isDraggable,
  linkedDirectionsCount,
  shareToken,
  onPointerDown,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDimensionsCorrected,
  onInspectDirection,
}: ReferenceCardProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const correctedRef = useRef(false);

  const content = (item.content as ReferenceItemContent) || {};
  const rawImageUrl = item.reference?.thumbnail_url || content.thumbnail_url || '';
  const imageUrl = useMemo(
    () => getCanvasSafeImageUrl(rawImageUrl, shareToken),
    [rawImageUrl, shareToken]
  );
  const title = item.reference?.title || content.title || 'Reference';
  const domain = item.reference?.source_domain || content.source_domain || '';

  const [image, imageStatus] = useImage(imageUrl, 'anonymous');

  // Auto-correct dimensions once the thumbnail natural size is known
  useEffect(() => {
    if (correctedRef.current) return;
    if (imageStatus === 'loaded' && image && image.width > 0 && image.height > 0) {
      const naturalRatio = image.height / image.width;
      const currentRatio = item.height / item.width;
      if (Math.abs(currentRatio - naturalRatio) > 0.03) {
        correctedRef.current = true;
        const { width: corrW, height: corrH } = clampAspectDimensions(
          item.width,
          image.width,
          image.height
        );
        if (groupRef.current) groupRef.current.height(corrH);
        onDimensionsCorrected?.(item.id, corrW, corrH);
      }
    }
  }, [imageStatus, image, item.id, item.width, item.height, onDimensionsCorrected]);

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
    const rawW = Math.max(80, Math.round(node.width() * scaleX));
    const naturalW = image && image.width > 0 ? image.width : null;
    const naturalH = image && image.height > 0 ? image.height : null;
    const { width: nw, height: nh } =
      naturalW && naturalH
        ? clampAspectDimensions(rawW, naturalW, naturalH, 80, 60)
        : { width: rawW, height: Math.max(60, Math.round(node.height() * scaleY)) };
    node.width(nw);
    node.height(nh);
    onTransformEnd(item.id, node.x(), node.y(), nw, nh);
  };

  const cr = 6;
  const isLoaded = imageStatus === 'loaded' && image;

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
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        width={item.width}
        height={item.height}
        fill="#181816"
        stroke={isSelected ? '#f59e0b' : '#2a2a26'}
        strokeWidth={isSelected ? 1.5 : 1}
        cornerRadius={cr}
        shadowColor="black"
        shadowBlur={12}
        shadowOpacity={0.4}
        shadowOffset={{ x: 0, y: 4 }}
      />
      {isLoaded ? (
        <Group
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.roundRect(1, 1, item.width - 2, item.height - 2, cr - 1);
            ctx.closePath();
          }}
        >
          <KonvaImage image={image} x={0} y={0} width={item.width} height={item.height} />
        </Group>
      ) : (
        <Group>
          <Rect
            x={1}
            y={1}
            width={item.width - 2}
            height={item.height - 2}
            fill="#1c1b18"
            stroke="#2e2c26"
            strokeWidth={1}
            cornerRadius={cr - 1}
          />
          {/* Subtle Globe Glyph Badge */}
          <Rect
            x={(item.width - 32) / 2}
            y={Math.max(12, item.height / 2 - 42)}
            width={32}
            height={32}
            fill="#262521"
            stroke="#38362e"
            strokeWidth={1}
            cornerRadius={16}
          />
          <Path
            data="M 12 2 A 10 10 0 1 0 12 22 A 10 10 0 1 0 12 2 Z M 12 2 C 8.5 2 6.5 6.5 6.5 12 C 6.5 17.5 8.5 22 12 22 C 15.5 22 17.5 17.5 17.5 12 C 17.5 6.5 15.5 2 12 2 Z M 2 12 L 22 12"
            x={(item.width - 32) / 2 + 8}
            y={Math.max(12, item.height / 2 - 42) + 8}
            scale={{ x: 0.67, y: 0.67 }}
            stroke="#8c8a82"
            strokeWidth={1.5}
          />
          <Text
            text={title}
            x={16}
            y={Math.max(48, item.height / 2 - 4)}
            width={item.width - 32}
            fill="#e6e4df"
            fontSize={13}
            fontFamily="Inter"
            fontStyle="500"
            align="center"
            ellipsis
          />
          {domain && (
            <Text
              text={domain}
              x={16}
              y={Math.max(68, item.height / 2 + 16)}
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
      {/* Subtle Domain Tag Overlay on bottom left (shown over loaded images) */}
      {isLoaded && domain && (
        <Group x={6} y={item.height - 22}>
          <Rect
            width={Math.min(domain.length * 6 + 12, item.width - 12)}
            height={16}
            fill="rgba(0,0,0,0.75)"
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
      {linkedDirectionsCount !== undefined && linkedDirectionsCount > 0 && (
        <Group
          x={item.width - (linkedDirectionsCount >= 10 ? 38 : 32) - 6}
          y={6}
          onClick={(e) => {
            e.cancelBubble = true;
            if (item.reference_id && onInspectDirection) onInspectDirection(item.reference_id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            if (item.reference_id && onInspectDirection) onInspectDirection(item.reference_id);
          }}
        >
          <Rect
            width={linkedDirectionsCount >= 10 ? 38 : 32}
            height={18}
            fill="#181816"
            stroke="#d97706"
            strokeWidth={1}
            cornerRadius={4}
            shadowColor="black"
            shadowBlur={4}
            shadowOpacity={0.5}
            shadowOffset={{ x: 0, y: 1 }}
          />
          <Path
            data="M 12 2 A 10 10 0 1 0 12 22 A 10 10 0 1 0 12 2 Z M 16.24 7.76 L 14.12 14.12 L 7.76 16.24 L 9.88 9.88 L 16.24 7.76 Z"
            x={4}
            y={3}
            scale={{ x: 0.5, y: 0.5 }}
            stroke="#d97706"
            strokeWidth={1.5}
          />
          <Text
            text={String(linkedDirectionsCount)}
            x={18}
            y={4}
            fill="#e6e4df"
            fontSize={10}
            fontFamily="Inter"
            fontStyle="600"
          />
        </Group>
      )}
    </Group>
  );
}
