'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Konva from 'konva';
import {
  calculateCenteredZoom,
  clampViewportScale,
  MIN_CANVAS_SCALE,
  MAX_CANVAS_SCALE,
} from '../coordinates';
import type {
  ViewportTransform,
} from '../coordinates';
import type {
  UseCanvasViewportOptions,
  UseCanvasViewportReturn,
  ViewportDimensions,
} from './viewportTypes';

export function useCanvasViewport({
  stageRef,
  viewport,
  onViewportChange,
  onZoomToFit,
  isTextInputActive,
  disabled = false,
}: UseCanvasViewportOptions): UseCanvasViewportReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<ViewportDimensions>({ width: 800, height: 600 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);

  const isMiddlePanningRef = useRef(false);
  const middlePanStartRef = useRef<{
    clientX: number;
    clientY: number;
    vx: number;
    vy: number;
    scale: number;
  }>({
    clientX: 0,
    clientY: 0,
    vx: 0,
    vy: 0,
    scale: 1,
  });

  // Ensure only the primary mouse button (button 0) initiates Konva node dragging
  useEffect(() => {
    Konva.dragButtons = [0];
  }, []);

  // Track container dimensions via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();

    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(container);

    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Global window mousemove & mouseup listeners for Middle-Mouse pan
  // INVARIANT: Updates both the live Konva Stage and React viewport state in the exact same event cycle
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isMiddlePanningRef.current || disabled) return;
      e.preventDefault();

      const dx = e.clientX - middlePanStartRef.current.clientX;
      const dy = e.clientY - middlePanStartRef.current.clientY;
      const nextX = Math.round(middlePanStartRef.current.vx + dx);
      const nextY = Math.round(middlePanStartRef.current.vy + dy);
      const currentScale = middlePanStartRef.current.scale;

      // Update Konva Stage imperatively for instantaneous fluid rendering
      const stage = stageRef.current;
      if (stage) {
        stage.x(nextX);
        stage.y(nextY);
        stage.batchDraw();
      }

      // Update React state in the exact same event tick
      onViewportChange({
        x: nextX,
        y: nextY,
        scale: currentScale,
      });
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || isMiddlePanningRef.current) {
        if (isMiddlePanningRef.current) {
          isMiddlePanningRef.current = false;
          setIsMiddlePanning(false);
        }
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [disabled, stageRef, onViewportChange]);

  // Spacebar pan (Hold Space) & Zoom to Fit (Cmd/Ctrl + 0) keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (isTextInputActive?.()) return;

      // Spacebar pan toggle
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      // Zoom to Fit: Cmd/Ctrl + 0
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        onZoomToFit?.(dimensions.width, dimensions.height);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [disabled, dimensions.width, dimensions.height, isTextInputActive, onZoomToFit]);

  // Container middle-click down handler to initiate middle-mouse pan
  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.button === 1) {
        e.preventDefault();
        isMiddlePanningRef.current = true;
        middlePanStartRef.current = {
          clientX: e.clientX,
          clientY: e.clientY,
          vx: viewport.x,
          vy: viewport.y,
          scale: viewport.scale,
        };
        setIsMiddlePanning(true);
      }
    },
    [disabled, viewport.x, viewport.y, viewport.scale]
  );

  // Mouse wheel zoom centered on cursor using authoritative calculateCenteredZoom
  // INVARIANT: Updates live Konva Stage and React state in the exact same event tick
  const handleWheel = useCallback(
    (e: { evt: WheelEvent; target?: unknown }) => {
      if (disabled) return;
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.08;
      const currentScale = stage.scaleX ? stage.scaleX() : viewport.scale;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const targetScale = direction > 0 ? currentScale * scaleBy : currentScale / scaleBy;

      const next = calculateCenteredZoom(viewport, pointer.x, pointer.y, targetScale);

      // Same-cycle synchronization: Konva Stage transform updated immediately
      stage.scaleX(next.scale);
      stage.scaleY(next.scale);
      stage.x(next.x);
      stage.y(next.y);
      stage.batchDraw();

      // Same-cycle synchronization: React state updated with identical values
      onViewportChange(next);
    },
    [disabled, stageRef, viewport, onViewportChange]
  );

  // Spacebar pan drag move handler on Stage
  // INVARIANT: React viewport state receives continuous position updates on every drag frame
  const handleStageDragMove = useCallback(
    (e: { target: unknown }): boolean => {
      const stage = stageRef.current;
      if (stage && e.target === stage) {
        const nextX = stage.x();
        const nextY = stage.y();
        const nextScale = stage.scaleX ? stage.scaleX() : viewport.scale;

        onViewportChange({
          x: nextX,
          y: nextY,
          scale: nextScale,
        });
        return true;
      }
      return false;
    },
    [stageRef, viewport.scale, onViewportChange]
  );

  // Spacebar pan drag end handler on Stage
  const handleStageDragEnd = useCallback(
    (e: { target: unknown }): boolean => {
      const stage = stageRef.current;
      if (stage && e.target === stage) {
        const nextX = stage.x();
        const nextY = stage.y();
        const nextScale = stage.scaleX ? stage.scaleX() : viewport.scale;

        onViewportChange({
          x: nextX,
          y: nextY,
          scale: nextScale,
        });
        return true;
      }
      return false;
    },
    [stageRef, viewport.scale, onViewportChange]
  );

  // Programmatic Zoom Helpers (e.g. from toolbar buttons)
  const zoomIn = useCallback(() => {
    const stage = stageRef.current;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const next = calculateCenteredZoom(viewport, centerX, centerY, viewport.scale * 1.25);

    if (stage) {
      stage.scaleX(next.scale);
      stage.scaleY(next.scale);
      stage.x(next.x);
      stage.y(next.y);
      stage.batchDraw();
    }
    onViewportChange(next);
  }, [stageRef, dimensions.width, dimensions.height, viewport, onViewportChange]);

  const zoomOut = useCallback(() => {
    const stage = stageRef.current;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const next = calculateCenteredZoom(viewport, centerX, centerY, viewport.scale / 1.25);

    if (stage) {
      stage.scaleX(next.scale);
      stage.scaleY(next.scale);
      stage.x(next.x);
      stage.y(next.y);
      stage.batchDraw();
    }
    onViewportChange(next);
  }, [stageRef, dimensions.width, dimensions.height, viewport, onViewportChange]);

  const resetViewport = useCallback(() => {
    const stage = stageRef.current;
    const next: ViewportTransform = { x: 0, y: 0, scale: 1 };

    if (stage) {
      stage.scaleX(1);
      stage.scaleY(1);
      stage.x(0);
      stage.y(0);
      stage.batchDraw();
    }
    onViewportChange(next);
  }, [stageRef, onViewportChange]);

  return {
    containerRef,
    dimensions,
    isSpacePressed,
    isMiddlePanning,
    handleContainerMouseDown,
    handleWheel,
    handleStageDragMove,
    handleStageDragEnd,
    zoomIn,
    zoomOut,
    resetViewport,
  };
}
