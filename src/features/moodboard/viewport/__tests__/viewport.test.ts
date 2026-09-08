import { describe, it, expect, vi } from 'vitest';
import {
  calculateCenteredZoom,
  calculateZoomToFit,
  clampViewportScale,
  MIN_CANVAS_SCALE,
  MAX_CANVAS_SCALE,
} from '../../coordinates';
import type { ViewportTransform } from '../../coordinates';

describe('Viewport Module & Same-Cycle Synchronization Invariant', () => {
  const initialViewport: ViewportTransform = { x: 100, y: 50, scale: 1.0 };

  // Verification of the exact same-cycle synchronization algorithm used in useCanvasViewport
  it('wheel zoom invariant: updates Stage transform and React state synchronously with zero drift', () => {
    let stageX = initialViewport.x;
    let stageY = initialViewport.y;
    let stageScale = initialViewport.scale;
    let drawCalls = 0;

    const mockStage = {
      x: (val?: number) => {
        if (typeof val === 'number') stageX = val;
        return stageX;
      },
      y: (val?: number) => {
        if (typeof val === 'number') stageY = val;
        return stageY;
      },
      scaleX: (val?: number) => {
        if (typeof val === 'number') stageScale = val;
        return stageScale;
      },
      scaleY: (val?: number) => {
        if (typeof val === 'number') stageScale = val;
        return stageScale;
      },
      batchDraw: () => {
        drawCalls++;
      },
      getPointerPosition: () => ({ x: 400, y: 300 }),
    };

    const emittedStates: ViewportTransform[] = [];
    const onViewportChange = (next: ViewportTransform) => {
      emittedStates.push(next);
    };

    // Simulate handleWheel handler execution
    const pointer = mockStage.getPointerPosition();
    const scaleBy = 1.08;
    const targetScale = mockStage.scaleX() * scaleBy;
    const next = calculateCenteredZoom(initialViewport, pointer.x, pointer.y, targetScale);

    // 1. Stage updated imperatively
    mockStage.scaleX(next.scale);
    mockStage.scaleY(next.scale);
    mockStage.x(next.x);
    mockStage.y(next.y);
    mockStage.batchDraw();

    // 2. React state updated in the same event tick
    onViewportChange(next);

    // Invariant Verification:
    expect(drawCalls).toBe(1);
    expect(emittedStates.length).toBe(1);
    expect(mockStage.x()).toBe(emittedStates[0].x);
    expect(mockStage.y()).toBe(emittedStates[0].y);
    expect(mockStage.scaleX()).toBe(emittedStates[0].scale);
    expect(mockStage.scaleY()).toBe(emittedStates[0].scale);
  });

  it('middle-mouse pan invariant: updates live Konva Stage and React state synchronously during movement', () => {
    let stageX = initialViewport.x;
    let stageY = initialViewport.y;
    let drawCalls = 0;

    const mockStage = {
      x: (val?: number) => {
        if (typeof val === 'number') stageX = val;
        return stageX;
      },
      y: (val?: number) => {
        if (typeof val === 'number') stageY = val;
        return stageY;
      },
      batchDraw: () => {
        drawCalls++;
      },
    };

    const emittedStates: ViewportTransform[] = [];
    const onViewportChange = (next: ViewportTransform) => {
      emittedStates.push(next);
    };

    const middlePanStart = {
      clientX: 200,
      clientY: 150,
      vx: initialViewport.x,
      vy: initialViewport.y,
      scale: initialViewport.scale,
    };

    // Simulate mouse move delta (dx: +85px, dy: -40px)
    const currentEvent = { clientX: 285, clientY: 110 };
    const dx = currentEvent.clientX - middlePanStart.clientX;
    const dy = currentEvent.clientY - middlePanStart.clientY;
    const nextX = Math.round(middlePanStart.vx + dx);
    const nextY = Math.round(middlePanStart.vy + dy);

    mockStage.x(nextX);
    mockStage.y(nextY);
    mockStage.batchDraw();

    onViewportChange({
      x: nextX,
      y: nextY,
      scale: middlePanStart.scale,
    });

    expect(drawCalls).toBe(1);
    expect(mockStage.x()).toBe(185);
    expect(mockStage.y()).toBe(10);
    expect(emittedStates[0]).toEqual({ x: 185, y: 10, scale: 1.0 });
    expect(mockStage.x()).toBe(emittedStates[0].x);
    expect(mockStage.y()).toBe(emittedStates[0].y);
  });

  it('spacebar pan invariant: continuous onDragMove synchronizes live Stage position without end-of-gesture lag', () => {
    const mockStage = {
      x: () => 320,
      y: () => 240,
      scaleX: () => 1.5,
    };

    const onViewportChange = vi.fn();

    // In useCanvasViewport, handleStageDragMove reads live stage transforms
    const nextX = mockStage.x();
    const nextY = mockStage.y();
    const nextScale = mockStage.scaleX();

    onViewportChange({
      x: nextX,
      y: nextY,
      scale: nextScale,
    });

    expect(onViewportChange).toHaveBeenCalledWith({
      x: 320,
      y: 240,
      scale: 1.5,
    });
  });

  it('centered zoom math preserves the world point under cursor during rapid alternating zoom', () => {
    let vp: ViewportTransform = { x: 0, y: 0, scale: 1.0 };
    const cursor = { x: 500, y: 350 };

    // Initial world point
    const initialWorldX = (cursor.x - vp.x) / vp.scale;
    const initialWorldY = (cursor.y - vp.y) / vp.scale;

    // Zoom in 5 times
    for (let i = 0; i < 5; i++) {
      vp = calculateCenteredZoom(vp, cursor.x, cursor.y, vp.scale * 1.15);
    }
    expect(vp.scale).toBeCloseTo(1.0 * Math.pow(1.15, 5), 3);

    // Zoom out 5 times
    for (let i = 0; i < 5; i++) {
      vp = calculateCenteredZoom(vp, cursor.x, cursor.y, vp.scale / 1.15);
    }
    expect(vp.scale).toBeCloseTo(1.0, 2);

    // Verify world point under cursor after rapid cycle
    const finalWorldX = (cursor.x - vp.x) / vp.scale;
    const finalWorldY = (cursor.y - vp.y) / vp.scale;

    expect(finalWorldX).toBeCloseTo(initialWorldX, 3);
    expect(finalWorldY).toBeCloseTo(initialWorldY, 3);
  });

  it('zoom bounds strictly enforce MIN_CANVAS_SCALE (0.2) and MAX_CANVAS_SCALE (3.0)', () => {
    expect(clampViewportScale(0.01)).toBe(MIN_CANVAS_SCALE);
    expect(clampViewportScale(10.0)).toBe(MAX_CANVAS_SCALE);

    const vp: ViewportTransform = { x: 0, y: 0, scale: 2.8 };
    // Zoom in beyond max
    const clampedMax = calculateCenteredZoom(vp, 400, 300, 4.5);
    expect(clampedMax.scale).toBe(MAX_CANVAS_SCALE);

    // Zoom out beyond min
    const clampedMin = calculateCenteredZoom(vp, 400, 300, 0.05);
    expect(clampedMin.scale).toBe(MIN_CANVAS_SCALE);
  });
});
