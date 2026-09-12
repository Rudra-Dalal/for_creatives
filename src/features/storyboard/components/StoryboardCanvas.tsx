'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StoryboardStage } from '../canvas/StoryboardStage';
import { StoryboardToolbar } from './StoryboardToolbar';
import { clampScale, calculateZoomToFit } from '../utils/storyboardCoordinates';
import type {
  StoryboardViewport,
  StoryboardTool,
  StoryboardSceneWithShots,
  StoryboardBounds,
} from '../types';

interface StoryboardCanvasProps {
  projectId: string;
  projectName?: string;
  scenes?: StoryboardSceneWithShots[];
  readOnly?: boolean;
  children?: React.ReactNode;
}

export function StoryboardCanvas({
  projectId,
  projectName = 'Storyboard',
  scenes = [],
  readOnly = false,
  children,
}: StoryboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 800,
  });

  const [activeTool, setActiveTool] = useState<StoryboardTool>('select');

  // Initialize viewport from localStorage if available
  const [viewport, setViewport] = useState<StoryboardViewport>(() => {
    if (typeof window !== 'undefined' && projectId) {
      try {
        const saved = localStorage.getItem(`storyboard_viewport_${projectId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            typeof parsed.x === 'number' &&
            typeof parsed.y === 'number' &&
            typeof parsed.scale === 'number'
          ) {
            return {
              x: parsed.x,
              y: parsed.y,
              scale: clampScale(parsed.scale),
            };
          }
        }
      } catch {
        // ignore JSON parse error
      }
    }
    return { x: 0, y: 0, scale: 1.0 };
  });

  // Responsive dimension tracking via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Viewport change handler with throttled localStorage persistence
  const handleViewportChange = useCallback(
    (newViewport: StoryboardViewport) => {
      setViewport(newViewport);
      if (typeof window !== 'undefined' && projectId) {
        try {
          localStorage.setItem(
            `storyboard_viewport_${projectId}`,
            JSON.stringify(newViewport)
          );
        } catch {
          // ignore storage quota error
        }
      }
    },
    [projectId]
  );

  // Zoom to fit calculation
  const handleZoomToFit = useCallback(() => {
    const allBounds: StoryboardBounds[] = [];

    // Collect scene bounds
    for (const scene of scenes) {
      allBounds.push({
        x: scene.x,
        y: scene.y,
        width: scene.width,
        height: scene.height,
      });

      // Collect shot bounds
      for (const shot of scene.shots) {
        allBounds.push({
          x: shot.x,
          y: shot.y,
          width: shot.width,
          height: shot.height,
        });
      }
    }

    const fitted = calculateZoomToFit(
      allBounds,
      dimensions.width,
      dimensions.height,
      80
    );
    handleViewportChange(fitted);
  }, [scenes, dimensions.width, dimensions.height, handleViewportChange]);

  // Keyboard shortcut listener for tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      else if (key === 's') setActiveTool('shot');
      else if (key === 'c') setActiveTool('scene');
      else if (key === 'x') setActiveTool('connect');
      else if (key === 'p') setActiveTool('pen');
      else if (key === 'e') setActiveTool('eraser');
      else if (key === 'z' || (e.shiftKey && key === '!')) {
        handleZoomToFit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomToFit]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex-1 relative overflow-hidden bg-background select-none"
    >
      {/* Floating Canvas HUD Toolbar */}
      <StoryboardToolbar
        activeTool={activeTool}
        onChangeActiveTool={setActiveTool}
        viewport={viewport}
        onViewportChange={handleViewportChange}
        onZoomToFit={handleZoomToFit}
        readOnly={readOnly}
      />

      {/* Main Konva Viewport Stage */}
      <StoryboardStage
        viewport={viewport}
        onViewportChange={handleViewportChange}
        activeTool={activeTool}
        containerWidth={dimensions.width}
        containerHeight={dimensions.height}
        readOnly={readOnly}
      >
        {children}
      </StoryboardStage>
    </div>
  );
}
