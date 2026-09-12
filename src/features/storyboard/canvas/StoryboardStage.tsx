'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage } from 'react-konva';
import type Konva from 'konva';
import { StoryboardBackground } from './StoryboardBackground';
import { clampScale } from '../utils/storyboardCoordinates';
import type { StoryboardViewport, StoryboardTool } from '../types';

export interface StoryboardStageProps {
  viewport: StoryboardViewport;
  onViewportChange: (viewport: StoryboardViewport) => void;
  activeTool: StoryboardTool;
  containerWidth: number;
  containerHeight: number;
  readOnly?: boolean;
  children?: React.ReactNode;
}

export function StoryboardStage({
  viewport,
  onViewportChange,
  activeTool,
  containerWidth,
  containerHeight,
  readOnly = false,
  children,
}: StoryboardStageProps) {
  const stageRef = useRef<Konva.Stage | null>(null);

  // Transient interaction refs to avoid React re-renders during high-frequency panning
  const isPanningRef = useRef<boolean>(false);
  const isSpacePressedRef = useRef<boolean>(false);
  const panStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartViewportRef = useRef<StoryboardViewport>(viewport);

  // Local cursor styling
  const [cursorStyle, setCursorStyle] = useState<string>('default');

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

  // Stage Mouse Down: Pan initiation
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
      }
    },
    [viewport]
  );

  // Stage Mouse Move: Pan update
  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isPanningRef.current) return;

      const dx = e.evt.clientX - panStartPointerRef.current.x;
      const dy = e.evt.clientY - panStartPointerRef.current.y;

      const newViewport: StoryboardViewport = {
        x: panStartViewportRef.current.x + dx,
        y: panStartViewportRef.current.y + dy,
        scale: panStartViewportRef.current.scale,
      };

      onViewportChange(newViewport);
    },
    [onViewportChange]
  );

  // Stage Mouse Up: Pan end
  const handleMouseUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setCursorStyle(isSpacePressedRef.current ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair');
    }
  }, [activeTool]);

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
    [viewport, onViewportChange]
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
        onWheel={handleWheel}
      >
        {/* Isolated Dotted Background Layer */}
        <StoryboardBackground
          width={containerWidth}
          height={containerHeight}
          viewport={viewport}
        />

        {/* Future Storyboard Layers (Scenes, Shots, Connectors, Annotations) */}
        {children}
      </Stage>
    </div>
  );
}
