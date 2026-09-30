'use client';

import React, { useRef, useMemo } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import type { StoryboardShotWithLinks } from '../types';
import { calculateShotDimensions } from '../utils/storyboardGeometry';
import {
  getShotFrameImageUrl,
  shotHasVisualFrame,
  computeCoverFit,
} from '../utils/shotFrameUtils';

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

  const handleDragStart = (_e: Konva.KonvaEventObject<DragEvent>) => {
    onDragStart(shot.id, shot.x, shot.y);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragMove(shot.id, e);
  };

  const handleDragEnd = (_e: Konva.KonvaEventObject<DragEvent>) => {
    const node = groupRef.current;
    if (!node) return;
    const newX = Math.round(node.x());
    const newY = Math.round(node.y());
    onDragEnd(shot.id, newX, newY);
  };

  const cornerRadius = 8;
  const isHighlighted = isSelected || isMultiSelected;

  // ── Visual Frame Image ──────────────────────────────────────────────────────
  // Inner frame dimensions (card has 6px padding on each side)
  const frameW = cardWidth - 12;
  const frameH = frameHeight;

  // Only compute / load an image when this shot actually has a visual frame set.
  const hasFrame = shotHasVisualFrame(shot.visual_source, shot.visual_url);

  // Resolve the URL once; external URLs are routed through /api/proxy-image.
  const safeImageUrl = useMemo(
    () => (hasFrame ? getShotFrameImageUrl(shot.visual_url) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasFrame, shot.visual_url]
  );

  // `useImage` from `use-image` v1.x — returns [HTMLImageElement | undefined, status].
  // When safeImageUrl is '' it issues no network request; status stays 'loading' safely.
  const [frameImage, frameImageStatus] = useImage(safeImageUrl, 'anonymous');

  const isFrameLoaded = hasFrame && frameImageStatus === 'loaded' && !!frameImage;
  const isFrameFailed = hasFrame && frameImageStatus === 'failed';

  // Cover-fit: scale image so its shorter axis fills the frame; centre, then clip.
  // IMAGE FIT DECISION: cover — matches moodboard reference card convention, never
  // distorts the image, always fills the frame area without empty letterbox areas.
  const coverFit = useMemo(() => {
    if (!isFrameLoaded || !frameImage) return null;
    return computeCoverFit(frameImage.width, frameImage.height, frameW, frameH);
  }, [isFrameLoaded, frameImage, frameW, frameH]);

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

      {/* 2. Dominant Visual Frame Area (6px inset each side) */}
      <Group x={6} y={6}>
        {/* 2a. Frame background — always rendered as lowest layer in the frame area */}
        <Rect
          x={0}
          y={0}
          width={frameW}
          height={frameH}
          fill="#11100E"
          stroke="#26241F"
          strokeWidth={1}
          cornerRadius={5}
          listening={false}
        />

        {/*
         * 2b. Visual frame image — rendered only when loaded successfully.
         *
         * IMAGE FIT: cover
         *   The KonvaImage is drawn larger than the frame on the crop axis and
         *   centred so the crop is symmetric. The surrounding Group clips it to
         *   the exact frame bounds (with matching 5px corner radius) so overflowing
         *   pixels are never visible. The frame aspect ratio is fixed by
         *   calculateShotDimensions; the source image may differ, hence cover-fit.
         *
         * EVENT ISOLATION: listening={false} on both Group and KonvaImage ensures
         *   no pointer events hit the image — all interaction falls through to the
         *   parent ShotCardNode Group (click, drag, dblclick remain on the shot).
         */}
        {isFrameLoaded && coverFit && (
          <Group
            clipFunc={(ctx) => {
              ctx.beginPath();
              // Match the 5px cornerRadius of the backing Rect
              ctx.roundRect(0, 0, frameW, frameH, 5);
              ctx.closePath();
            }}
            listening={false}
          >
            <KonvaImage
              image={frameImage}
              x={coverFit.offsetX}
              y={coverFit.offsetY}
              width={coverFit.drawW}
              height={coverFit.drawH}
              listening={false}
              perfectDrawEnabled={false}
            />
          </Group>
        )}

        {/*
         * 2c. Empty-state / loading / failure placeholder.
         *   Visible when:
         *   - No frame is assigned (visual_source === 'none' or visual_url empty)
         *   - Frame URL is currently loading (hasFrame && !isFrameLoaded && !isFrameFailed)
         *   - Frame URL failed to load — degrades gracefully to a muted "unavailable" hint.
         *     No layout shift occurs: the backing Rect (2a) always occupies full frame dims.
         */}
        {(!hasFrame || (!isFrameLoaded && !isFrameFailed) || isFrameFailed) && (
          <Group listening={false}>
            {/* Centre quiet mark / framing guide */}
            <Rect
              x={frameW / 2 - 12}
              y={frameH / 2 - 12}
              width={24}
              height={24}
              stroke={isFrameFailed ? '#3D2020' : '#2F2D27'}
              strokeWidth={1}
              cornerRadius={3}
            />
            <Text
              x={0}
              y={frameH / 2 + 18}
              width={frameW}
              align="center"
              text={isFrameFailed ? 'Frame unavailable' : 'Empty Frame'}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontSize={10}
              fill={isFrameFailed ? '#5C3333' : '#524F47'}
            />
          </Group>
        )}

        {/* 2d. Frame Overlay: Top-Left Shot Number Pill — always rendered on top of image */}
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
            listening={false}
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

        {/* 2e. Frame Overlay: Top-Right Aspect Ratio Badge */}
        <Group x={frameW - 46} y={8}>
          <Rect
            x={0}
            y={0}
            width={38}
            height={20}
            fill="rgba(18, 17, 14, 0.85)"
            stroke="#38352C"
            strokeWidth={1}
            cornerRadius={3}
            listening={false}
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
            <Group
              x={shot.shot_type ? Math.max(48, shot.shot_type.length * 7 + 14) + 6 : 0}
              y={0}
            >
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
