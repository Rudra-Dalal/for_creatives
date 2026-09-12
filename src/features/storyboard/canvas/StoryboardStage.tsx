'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { StoryboardBackground } from './StoryboardBackground';
import { StoryboardMarquee } from './StoryboardMarquee';
import { clampScale } from '../utils/storyboardCoordinates';
import type { StoryboardViewport, StoryboardTool } from '../types';

export interface StoryboardStageProps {
  viewport: StoryboardViewport;
  onViewportChange: (viewport: StoryboardViewport) => void;
  activeTool: StoryboardTool;
  containerWidth: number;
  containerHeight: number;
  readOnly?: boolean;
  marqueeBounds?: { x: number; y: number; width: number; height: number } | null;
  onStageMouseDown?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onStageMouseMove?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onStageMouseUp?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onStageClick?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  stageRef?: React.MutableRefObject<Konva.Stage | null>;
  children?: React.ReactNode;
}

export function StoryboardStage({
  viewport,
  onViewportChange,
  activeTool,
  containerWidth,
  containerHeight,
  readOnly = false,
  marqueeBounds = null,
  onStageMouseDown,
  onStageMouseMove,
  onStageMouseUp,
  onStageClick,
  stageRef: externalStageRef,
  children,
}: StoryboardStageProps) {
  const internalStageRef = useRef<Konva.Stage | null>(null);
  const stageRef = externalStageRef || internalStageRef;

  // Transient interaction refs to avoid React re-renders during high-frequency panning
  const isPanningRef = useRef<boolean>(false);
  const isSpacePressedRef = useRef<boolean>(false);
  const panStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartViewportRef = useRef<StoryboardViewport>(viewport);

  // Local cursor styling
  const [cursorStyle, setCursorStyle] = useState<string>(
    activeTool === 'select' ? 'default' : 'crosshair'
  );

  // Synchronize cursor style when active tool changes
  useEffect(() => {
    if (!isPanningRef.current && !isSpacePressedRef.current) {
      setCursorStyle(activeTool === 'select' ? 'default' : 'crosshair');
    }
  }, [activeTool]);

  // Spacebar key tracking for pan shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpacePressedRef.current = true;
        setCursorStyle('grab');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        if (!isPanningRef.current) {
          setCursorStyle(activeTool === 'select' ? 'default' : 'crosshair');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool]);

  // Stage Mouse Down: Pan initiation or stage forward
  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const isMiddleClick = e.evt.button === 1;
      const isLeftWithSpace = e.evt.button === 0 && isSpacePressedRef.current;

      if (isMiddleClick || isLeftWithSpace) {
        e.evt.preventDefault();
        isPanningRef.current = true;
        panStartPointerRef.current = { x: e.evt.clientX, y: e.evt.clientY };
        panStartViewportRef.current = { ...viewport };
        setCursorStyle('grabbing');
      } else {
        onStageMouseDown?.(e);
      }
    },
    [viewport, onStageMouseDown]
  );

  // Stage Mouse Move: Pan update or stage forward
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanningRef.current) {
        const dx = e.evt.clientX - panStartPointerRef.current.x;
        const dy = e.evt.clientY - panStartPointerRef.current.y;

        const newViewport: StoryboardViewport = {
          x: panStartViewportRef.current.x + dx,
          y: panStartViewportRef.current.y + dy,
          scale: panStartViewportRef.current.scale,
        };

        onViewportChange(newViewport);
      } else {
        onStageMouseMove?.(e);
      }
    },
    [onViewportChange, onStageMouseMove]
  );

  // Stage Mouse Up: Pan end or stage forward
  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setCursorStyle(isSpacePressedRef.current ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair');
      } else {
        onStageMouseUp?.(e);
      }
    },
    [activeTool, onStageMouseUp]
  );

  // Stage Wheel: Trackpad pan & Cmd/Ctrl pinch-zoom
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const isZoomGesture = e.evt.ctrlKey || e.evt.metaKey;

      if (isZoomGesture) {
        // Zooming towards pointer
        const zoomFactor = 1.05;
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const oldScale = viewport.scale;

        const newScale = clampScale(
          direction > 0 ? oldScale * zoomFactor : oldScale / zoomFactor
        );

        const mousePointTo = {
          x: (pointer.x - viewport.x) / oldScale,
          y: (pointer.y - viewport.y) / oldScale,
        };

        const newViewport: StoryboardViewport = {
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
          scale: newScale,
        };

        onViewportChange(newViewport);
      } else {
        // Two-finger trackpad panning
        const newViewport: StoryboardViewport = {
          x: viewport.x - e.evt.deltaX,
          y: viewport.y - e.evt.deltaY,
          scale: viewport.scale,
        };

        onViewportChange(newViewport);
      }
    },
    [viewport, onViewportChange, stageRef]
  );

  // Global window mouseup in case pointer releases outside stage
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setCursorStyle(isSpacePressedRef.current ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair');
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [activeTool]);

  return (
    <div
      style={{
        width: containerWidth,
        height: containerHeight,
        cursor: cursorStyle,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Stage
        ref={stageRef}
        width={containerWidth}
        height={containerHeight}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={onStageClick}
        onWheel={handleWheel}
      >
        {/* Isolated Dotted Background Layer */}
        <StoryboardBackground
          width={containerWidth}
          height={containerHeight}
          viewport={viewport}
        />

        {/* Storyboard Interactive Objects & Marquee Layer */}
        <Layer name="storyboard-objects-layer">
          {children}
          <StoryboardMarquee bounds={marqueeBounds} />
        </Layer>
      </Stage>
    </div>
  );
}
