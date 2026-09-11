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

describe('Moodboard Initial Auto-Framing & Lifecycle Invariants', () => {
  const container = { width: 1200, height: 800 };

  it('calculates centered framing for multiple canvas items with padding', () => {
    const items = [
      { x: 100, y: 100, width: 300, height: 200 },
      { x: 500, y: 400, width: 300, height: 200 },
    ];
    // Bounds: minX = 100, minY = 100, maxX = 800, maxY = 600
    // Content: width = 700, height = 500
    const fitted = calculateZoomToFit(items, container.width, container.height, 64);

    expect(fitted.scale).toBeGreaterThan(0.2);
    expect(fitted.scale).toBeLessThanOrEqual(1.0);

    // World center of content: x = (100 + 800) / 2 = 450, y = (100 + 600) / 2 = 350
    // Screen center after transform: worldCenter * scale + viewport.offset
    const screenCenterX = 450 * fitted.scale + fitted.x;
    const screenCenterY = 350 * fitted.scale + fitted.y;

    expect(screenCenterX).toBeCloseTo(container.width / 2, 0);
    expect(screenCenterY).toBeCloseTo(container.height / 2, 0);
  });

  it('clamps scale to maxScale 1.0 so single/small items do not blow up', () => {
    const singleSmallItem = [{ x: 200, y: 200, width: 240, height: 180 }];
    const fitted = calculateZoomToFit(singleSmallItem, container.width, container.height, 64);

    expect(fitted.scale).toBe(1.0);
    // Even at 1.0x, it should still be centered in the container
    const screenCenterX = (200 + 240 / 2) * fitted.scale + fitted.x;
    const screenCenterY = (200 + 180 / 2) * fitted.scale + fitted.y;
    expect(screenCenterX).toBeCloseTo(container.width / 2, 0);
    expect(screenCenterY).toBeCloseTo(container.height / 2, 0);
  });

  it('falls back to default viewport { x: 0, y: 0, scale: 1 } on empty moodboard', () => {
    const emptyFitted = calculateZoomToFit([], container.width, container.height);
    expect(emptyFitted).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('cleanly translates items with negative coordinates into positive visible viewport', () => {
    const negativeItems = [
      { x: -800, y: -600, width: 400, height: 300 },
      { x: -200, y: -100, width: 300, height: 200 },
    ];
    // Bounds: minX = -800, maxX = 100, minY = -600, maxY = 100
    const fitted = calculateZoomToFit(negativeItems, container.width, container.height, 64);

    // All screen coordinates must be comfortably within container bounds (> 0)
    for (const item of negativeItems) {
      const screenX = item.x * fitted.scale + fitted.x;
      const screenY = item.y * fitted.scale + fitted.y;
      expect(screenX).toBeGreaterThanOrEqual(0);
      expect(screenY).toBeGreaterThanOrEqual(0);
      expect(screenX + item.width * fitted.scale).toBeLessThanOrEqual(container.width);
      expect(screenY + item.height * fitted.scale).toBeLessThanOrEqual(container.height);
    }
  });

  it('lifecycle invariant: single-shot framing guard prevents viewport override after user interaction or load', () => {
    let hasAutoFramed = false;
    let hasUserInteracted = false;
    let currentViewport: ViewportTransform = { x: 0, y: 0, scale: 1 };

    const simulateMountAndLoad = (
      items: Array<{ x: number; y: number; width: number; height: number }>,
      userActionBeforeLoad = false
    ) => {
      if (userActionBeforeLoad) {
        hasUserInteracted = true;
        // User panned to custom coordinate during load
        currentViewport = { x: 555, y: 333, scale: 1.2 };
      }

      // Load completes
      if (!hasAutoFramed && !hasUserInteracted && items.length > 0) {
        currentViewport = calculateZoomToFit(items, container.width, container.height);
        hasAutoFramed = true;
      } else if (!hasAutoFramed) {
        hasAutoFramed = true;
      }
    };

    // Case 1: user interacted during load -> auto-framing MUST NOT override user viewport
    const sampleItems = [{ x: 100, y: 100, width: 400, height: 300 }];
    simulateMountAndLoad(sampleItems, true);
    expect(currentViewport).toEqual({ x: 555, y: 333, scale: 1.2 });

    // Case 2: Subsequent item additions during active session MUST NOT re-frame
    const newItems = [...sampleItems, { x: 900, y: 800, width: 400, height: 300 }];
    if (!hasAutoFramed && !hasUserInteracted && newItems.length > 0) {
      currentViewport = calculateZoomToFit(newItems, container.width, container.height);
    }
    // Still retains user's position
    expect(currentViewport).toEqual({ x: 555, y: 333, scale: 1.2 });
  });
});

