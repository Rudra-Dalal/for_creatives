import { describe, it, expect } from 'vitest';
import {
  CLICK_VS_DRAG_THRESHOLD_PX,
  MIN_CANVAS_SCALE,
  MAX_CANVAS_SCALE,
  CORNER_PRIORITY_ZONE_PX,
  screenToCanvas,
  canvasToScreen,
  canvasToClient,
  pointToCanvas,
  getPointerCanvasPosition,
  getScreenScaledPadding,
  isPointInBounds,
  isDragGesture,
  isPointInCornerZone,
  calculateItemBounds,
  clampViewportScale,
  calculateCenteredZoom,
  calculateZoomToFit,
} from '../index';
import type { ViewportTransform, ContainerRect, CanvasBounds } from '../index';

describe('Authoritative Coordinates Module', () => {
  const defaultViewport: ViewportTransform = { x: 100, y: 50, scale: 1.5 };
  const containerRect: ContainerRect = { left: 200, top: 100, width: 1000, height: 800 };

  describe('Bidirectional Transformations', () => {
    it('screenToCanvas and canvasToScreen maintain mathematical identity', () => {
      const testCases = [
        { clientX: 350, clientY: 250 },
        { clientX: 200, clientY: 100 },
        { clientX: 1200, clientY: 900 },
      ];

      for (const tc of testCases) {
        // Convert screen client pos -> canvas world pos
        const canvasPt = screenToCanvas(tc.clientX, tc.clientY, containerRect, defaultViewport);

        // Convert canvas world pos -> container screen pos
        const containerPt = canvasToScreen(canvasPt.x, canvasPt.y, defaultViewport);

        // Convert to client pos
        const clientPt = canvasToClient(canvasPt.x, canvasPt.y, defaultViewport, containerRect);

        expect(clientPt.x).toBeCloseTo(tc.clientX, 5);
        expect(clientPt.y).toBeCloseTo(tc.clientY, 5);
        expect(containerPt.x).toBeCloseTo(tc.clientX - containerRect.left, 5);
        expect(containerPt.y).toBeCloseTo(tc.clientY - containerRect.top, 5);
      }
    });

    it('handles varied zoom scales from 0.2x to 3.0x without precision degradation', () => {
      const scales = [0.2, 0.4, 0.75, 1.0, 1.8, 2.5, 3.0];
      const worldPt = { x: 450, y: -320 };

      for (const scale of scales) {
        const vp: ViewportTransform = { x: -120, y: 80, scale };
        const screenPt = canvasToScreen(worldPt.x, worldPt.y, vp);
        const reconstructedWorldPt = screenToCanvas(
          screenPt.x + containerRect.left,
          screenPt.y + containerRect.top,
          containerRect,
          vp
        );

        expect(reconstructedWorldPt.x).toBeCloseTo(worldPt.x, 5);
        expect(reconstructedWorldPt.y).toBeCloseTo(worldPt.y, 5);
      }
    });

    it('pointToCanvas transforms stage pointer to canvas space accurately', () => {
      const vp: ViewportTransform = { x: 50, y: -20, scale: 2 };
      const stagePt = { x: 250, y: 180 };
      const canvasPt = pointToCanvas(stagePt, vp);

      expect(canvasPt.x).toBe((250 - 50) / 2);
      expect(canvasPt.y).toBe((180 - (-20)) / 2);
    });
  });

  describe('getPointerCanvasPosition with Konva Stage', () => {
    it('returns null when stage is null or pointer position is null', () => {
      expect(getPointerCanvasPosition(null, defaultViewport)).toBeNull();

      const mockStageEmpty = {
        getPointerPosition: () => null,
      };
      expect(getPointerCanvasPosition(mockStageEmpty, defaultViewport)).toBeNull();
    });

    it('calculates world coordinates using live stage transforms', () => {
      const mockStage = {
        getPointerPosition: () => ({ x: 300, y: 200 }),
        scaleX: () => 2.0,
        scaleY: () => 2.0,
        x: () => 100,
        y: () => 50,
      };

      const pt = getPointerCanvasPosition(mockStage);
      expect(pt).not.toBeNull();
      expect(pt?.x).toBe((300 - 100) / 2);
      expect(pt?.y).toBe((200 - 50) / 2);
    });

    it('falls back to viewport transform if stage transform getters return undefined or 0', () => {
      const mockStageFallback = {
        getPointerPosition: () => ({ x: 250, y: 150 }),
      };

      const pt = getPointerCanvasPosition(mockStageFallback, defaultViewport);
      expect(pt).not.toBeNull();
      expect(pt?.x).toBe((250 - defaultViewport.x) / defaultViewport.scale);
      expect(pt?.y).toBe((150 - defaultViewport.y) / defaultViewport.scale);
    });
  });

  describe('Single Click vs Drag Threshold Constant', () => {
    it('is strictly set to 4px', () => {
      expect(CLICK_VS_DRAG_THRESHOLD_PX).toBe(4);
    });

    it('correctly evaluates boundary drag conditions against CLICK_VS_DRAG_THRESHOLD_PX', () => {
      const startX = 100;
      const startY = 100;

      // Exactly at rest
      expect(isDragGesture(startX, startY, 100, 100)).toBe(false);

      // Micro-jitter: 3.99px displacement -> not a drag (click preserved)
      expect(isDragGesture(startX, startY, 100 + 3.99, 100)).toBe(false);
      expect(isDragGesture(startX, startY, 100, 100 + 3.99)).toBe(false);

      // Exact threshold: 4.0px displacement -> false (must strictly exceed threshold)
      expect(isDragGesture(startX, startY, 100 + 4.0, 100)).toBe(false);

      // Exceeds threshold: 4.01px displacement -> drag gesture confirmed
      expect(isDragGesture(startX, startY, 100 + 4.01, 100)).toBe(true);

      // Diagonal displacement: dx=3, dy=3 => hypot=sqrt(18) ≈ 4.24px > 4px -> drag
      expect(isDragGesture(startX, startY, 103, 103)).toBe(true);

      // Diagonal displacement: dx=2, dy=2 => hypot=sqrt(8) ≈ 2.83px < 4px -> not drag
      expect(isDragGesture(startX, startY, 102, 102)).toBe(false);
    });
  });

  describe('Spatial Bounds & Hit Testing', () => {
    const bounds: CanvasBounds = { x: 50, y: 100, width: 200, height: 150 };

    it('isPointInBounds checks interior and exterior points', () => {
      // Inside
      expect(isPointInBounds({ x: 100, y: 150 }, bounds)).toBe(true);
      expect(isPointInBounds({ x: 50, y: 100 }, bounds)).toBe(true);
      expect(isPointInBounds({ x: 250, y: 250 }, bounds)).toBe(true);

      // Outside
      expect(isPointInBounds({ x: 40, y: 150 }, bounds)).toBe(false);
      expect(isPointInBounds({ x: 260, y: 150 }, bounds)).toBe(false);
      expect(isPointInBounds({ x: 100, y: 90 }, bounds)).toBe(false);
      expect(isPointInBounds({ x: 100, y: 260 }, bounds)).toBe(false);
    });

    it('isPointInBounds respects padding expansion buffer', () => {
      // 10px outside without padding is false
      expect(isPointInBounds({ x: 42, y: 100 }, bounds, 0)).toBe(false);

      // 10px outside with 15px padding is true
      expect(isPointInBounds({ x: 42, y: 100 }, bounds, 15)).toBe(true);
    });

    it('getScreenScaledPadding scales inversely with viewport zoom', () => {
      // At zoom=1.0, 20px padding is 20 canvas units
      expect(getScreenScaledPadding(20, 1.0)).toBe(20);

      // At zoom=2.0, 20px padding is 10 canvas units
      expect(getScreenScaledPadding(20, 2.0)).toBe(10);

      // At zoom=0.5, 20px padding is 40 canvas units
      expect(getScreenScaledPadding(20, 0.5)).toBe(40);
    });

    it('calculateItemBounds returns standard bounds object', () => {
      const item = { x: 10, y: 20, width: 300, height: 200, title: 'Test' };
      expect(calculateItemBounds(item)).toEqual({ x: 10, y: 20, width: 300, height: 200 });
    });
  });

  describe('Milanote Pattern 2: Corner Priority Zone', () => {
    const cardBounds: CanvasBounds = { x: 100, y: 100, width: 200, height: 160 };
    const scale = 1.0;

    it('identifies points within top-left, top-right, bottom-left, and bottom-right corner zones', () => {
      // Top-Left corner
      expect(isPointInCornerZone({ x: 105, y: 105 }, cardBounds, scale, CORNER_PRIORITY_ZONE_PX)).toBe(true);

      // Top-Right corner
      expect(isPointInCornerZone({ x: 295, y: 105 }, cardBounds, scale, CORNER_PRIORITY_ZONE_PX)).toBe(true);

      // Bottom-Left corner
      expect(isPointInCornerZone({ x: 105, y: 255 }, cardBounds, scale, CORNER_PRIORITY_ZONE_PX)).toBe(true);

      // Bottom-Right corner
      expect(isPointInCornerZone({ x: 295, y: 255 }, cardBounds, scale, CORNER_PRIORITY_ZONE_PX)).toBe(true);
    });

    it('identifies cardinal anchor points at midpoints as NOT in the corner zone', () => {
      // Top cardinal anchor (x: 200, y: 100) -> midpoint of top edge
      expect(isPointInCornerZone({ x: 200, y: 100 }, cardBounds, scale, CORNER_PRIORITY_ZONE_PX)).toBe(false);

      // Right cardinal anchor (x: 300, y: 180) -> midpoint of right edge
      expect(isPointInCornerZone({ x: 300, y: 180 }, cardBounds, scale, CORNER_PRIORITY_ZONE_PX)).toBe(false);

      // Bottom cardinal anchor (x: 200, y: 260) -> midpoint of bottom edge
      expect(isPointInCornerZone({ x: 200, y: 260 }, cardBounds, scale, CORNER_PRIORITY_ZONE_PX)).toBe(false);

      // Left cardinal anchor (x: 100, y: 180) -> midpoint of left edge
      expect(isPointInCornerZone({ x: 100, y: 180 }, cardBounds, scale, CORNER_PRIORITY_ZONE_PX)).toBe(false);
    });
  });

  describe('Viewport Zoom Calculations', () => {
    it('clampViewportScale constrains scale to min/max boundaries', () => {
      expect(clampViewportScale(0.05)).toBe(MIN_CANVAS_SCALE);
      expect(clampViewportScale(5.0)).toBe(MAX_CANVAS_SCALE);
      expect(clampViewportScale(1.4)).toBe(1.4);
    });

    it('calculateCenteredZoom keeps the cursor world point strictly anchored on screen', () => {
      const currentVp: ViewportTransform = { x: 50, y: 30, scale: 1.0 };
      const cursorScreen = { x: 400, y: 300 };

      // World point under cursor before zoom
      const worldBefore = screenToCanvas(
        cursorScreen.x + containerRect.left,
        cursorScreen.y + containerRect.top,
        containerRect,
        currentVp
      );

      // Zoom in to 1.8x centered on cursor
      const nextVp = calculateCenteredZoom(currentVp, cursorScreen.x, cursorScreen.y, 1.8);
      expect(nextVp.scale).toBe(1.8);

      // World point under cursor after zoom
      const worldAfter = screenToCanvas(
        cursorScreen.x + containerRect.left,
        cursorScreen.y + containerRect.top,
        containerRect,
        nextVp
      );

      // The world coordinate under the cursor MUST be identical before and after zoom
      expect(worldAfter.x).toBeCloseTo(worldBefore.x, 1);
      expect(worldAfter.y).toBeCloseTo(worldBefore.y, 1);
    });

    it('calculateZoomToFit frames multiple items inside container with padding', () => {
      const items = [
        { x: 100, y: 100, width: 200, height: 150 },
        { x: 500, y: 400, width: 200, height: 150 },
      ];

      const fitVp = calculateZoomToFit(items, 1000, 800, 50);
      expect(fitVp.scale).toBeGreaterThan(0.2);
      expect(fitVp.scale).toBeLessThanOrEqual(1.0);

      // Confirm items fit within container bounds when projected
      const item1Screen = canvasToScreen(100, 100, fitVp);
      expect(item1Screen.x).toBeGreaterThanOrEqual(0);
      expect(item1Screen.y).toBeGreaterThanOrEqual(0);
    });

    it('calculateZoomToFit returns default viewport when item list is empty', () => {
      expect(calculateZoomToFit([], 1000, 800)).toEqual({ x: 0, y: 0, scale: 1 });
    });
  });
});
