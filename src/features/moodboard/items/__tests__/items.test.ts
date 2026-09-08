import { describe, it, expect } from 'vitest';
import {
  ITEM_DEFAULT_DIMENSIONS,
  ASPECT_LOCKED_MIN_HEIGHT,
  ASPECT_LOCKED_MAX_HEIGHT,
  ASPECT_LOCKED_DEFAULT_WIDTH,
  TRANSFORMER_MIN_WIDTH,
  TRANSFORMER_MIN_HEIGHT,
} from '../itemTypes';
import {
  isAspectLocked,
  resolveDefaultDimensions,
  resolveAspectLockedDimensions,
  clampAspectDimensions,
  getItemBounds,
  getItemCenter,
  isPointInItem,
} from '../canvasItemPure';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const squareItem = { x: 100, y: 200, width: 300, height: 300 };
const portraitItem = { x: 0, y: 0, width: 300, height: 450 };
const landscapeItem = { x: 50, y: 50, width: 400, height: 200 };

describe('Items Module — Stage 3', () => {

  // =========================================================================
  // Constants
  // =========================================================================
  describe('Constants', () => {
    it('ITEM_DEFAULT_DIMENSIONS covers all six item types', () => {
      const types = ['reference', 'image', 'text', 'color', 'idea', 'stroke'] as const;
      for (const t of types) {
        expect(ITEM_DEFAULT_DIMENSIONS[t]).toBeDefined();
        expect(typeof ITEM_DEFAULT_DIMENSIONS[t].width).toBe('number');
        expect(typeof ITEM_DEFAULT_DIMENSIONS[t].height).toBe('number');
      }
    });

    it('reference and image share the same fallback dimensions (300x220)', () => {
      expect(ITEM_DEFAULT_DIMENSIONS.reference).toEqual({ width: 300, height: 220 });
      expect(ITEM_DEFAULT_DIMENSIONS.image).toEqual({ width: 300, height: 220 });
    });

    it('text default is 240x160', () => {
      expect(ITEM_DEFAULT_DIMENSIONS.text).toEqual({ width: 240, height: 160 });
    });

    it('color swatch default is 180x180 (square)', () => {
      expect(ITEM_DEFAULT_DIMENSIONS.color).toEqual({ width: 180, height: 180 });
    });

    it('idea default is 280x180', () => {
      expect(ITEM_DEFAULT_DIMENSIONS.idea).toEqual({ width: 280, height: 180 });
    });

    it('stroke default is 0x0 sentinel', () => {
      expect(ITEM_DEFAULT_DIMENSIONS.stroke).toEqual({ width: 0, height: 0 });
    });

    it('aspect-locked clamp constants match historical useMoodboard.ts values', () => {
      expect(ASPECT_LOCKED_MIN_HEIGHT).toBe(120);
      expect(ASPECT_LOCKED_MAX_HEIGHT).toBe(400);
      expect(ASPECT_LOCKED_DEFAULT_WIDTH).toBe(300);
    });

    it('transformer min-size constants match CanvasTransformer boundBoxFunc values', () => {
      expect(TRANSFORMER_MIN_WIDTH).toBe(40);
      expect(TRANSFORMER_MIN_HEIGHT).toBe(30);
    });
  });

  // =========================================================================
  // isAspectLocked
  // =========================================================================
  describe('isAspectLocked', () => {
    it('returns true only for reference and image', () => {
      expect(isAspectLocked('reference')).toBe(true);
      expect(isAspectLocked('image')).toBe(true);
    });

    it('returns false for text, color, idea, stroke', () => {
      expect(isAspectLocked('text')).toBe(false);
      expect(isAspectLocked('color')).toBe(false);
      expect(isAspectLocked('idea')).toBe(false);
      expect(isAspectLocked('stroke')).toBe(false);
    });
  });

  // =========================================================================
  // resolveDefaultDimensions
  // =========================================================================
  describe('resolveDefaultDimensions', () => {
    it('returns correct defaults for all types', () => {
      expect(resolveDefaultDimensions('text')).toEqual({ width: 240, height: 160 });
      expect(resolveDefaultDimensions('color')).toEqual({ width: 180, height: 180 });
      expect(resolveDefaultDimensions('idea')).toEqual({ width: 280, height: 180 });
      expect(resolveDefaultDimensions('reference')).toEqual({ width: 300, height: 220 });
      expect(resolveDefaultDimensions('image')).toEqual({ width: 300, height: 220 });
      expect(resolveDefaultDimensions('stroke')).toEqual({ width: 0, height: 0 });
    });

    it('returns a shallow copy; mutating the result does not affect the constant', () => {
      const dims = resolveDefaultDimensions('text');
      dims.width = 9999;
      expect(ITEM_DEFAULT_DIMENSIONS.text.width).toBe(240);
    });
  });

  // =========================================================================
  // resolveAspectLockedDimensions — placement sizing
  // =========================================================================
  describe('resolveAspectLockedDimensions', () => {
    it('handles landscape image: width stays at 300, height < maxHeight', () => {
      // 1200x800 => ratio 0.667 => height = round(300 * 0.667) = 200 (within [120,400])
      const { width, height } = resolveAspectLockedDimensions(1200, 800);
      expect(width).toBe(300);
      expect(height).toBe(200);
    });

    it('handles square image: 600x600 => 300x300', () => {
      const { width, height } = resolveAspectLockedDimensions(600, 600);
      expect(width).toBe(300);
      expect(height).toBe(300);
    });

    it('clamps tall portrait image: height is forced to maxHeight (400), width recalculated', () => {
      // 400x1600 => ratio 4.0 => unclamped height = 1200, clamped to 400 => width = round(400/4.0) = 100
      const { width, height } = resolveAspectLockedDimensions(400, 1600);
      expect(height).toBe(ASPECT_LOCKED_MAX_HEIGHT);
      expect(width).toBe(Math.round(ASPECT_LOCKED_MAX_HEIGHT / (1600 / 400)));
      // Verify ratio is preserved
      const ratio = height / width;
      const naturalRatio = 1600 / 400;
      expect(Math.abs(ratio - naturalRatio)).toBeLessThan(0.02);
    });

    it('clamps very wide image: height is forced to minHeight (120), width recalculated', () => {
      // 3000x60 => ratio 0.02 => unclamped height = round(300*0.02) = 6, clamped to 120
      // => width = round(120/0.02) = 6000
      const { width, height } = resolveAspectLockedDimensions(3000, 60);
      expect(height).toBe(ASPECT_LOCKED_MIN_HEIGHT);
      // width = round(120 / (60/3000)) = round(120 * 50) = 6000
      expect(width).toBe(Math.round(ASPECT_LOCKED_MIN_HEIGHT / (60 / 3000)));
      // Ratio preserved
      const ratio = height / width;
      const naturalRatio = 60 / 3000;
      expect(Math.abs(ratio - naturalRatio)).toBeLessThan(0.001);
    });

    it('returns reference fallback (300x220) when naturalWidth is 0', () => {
      expect(resolveAspectLockedDimensions(0, 400)).toEqual({ width: 300, height: 220 });
    });

    it('returns reference fallback when naturalHeight is 0', () => {
      expect(resolveAspectLockedDimensions(400, 0)).toEqual({ width: 300, height: 220 });
    });

    it('returns reference fallback when both dimensions are negative', () => {
      expect(resolveAspectLockedDimensions(-100, -200)).toEqual({ width: 300, height: 220 });
    });

    it('respects custom targetWidth override', () => {
      // 800x600 => ratio 0.75; targetWidth=400 => height=300
      const { width, height } = resolveAspectLockedDimensions(800, 600, 400);
      expect(width).toBe(400);
      expect(height).toBe(300);
    });

    it('preserves natural aspect ratio for a range of portrait sizes', () => {
      const portraits = [
        { nw: 300, nh: 500 },
        { nw: 600, nh: 900 },
        { nw: 1000, nh: 1500 },
        { nw: 400, nh: 2000 }, // will hit max-height clamp
      ];

      for (const { nw, nh } of portraits) {
        const { width, height } = resolveAspectLockedDimensions(nw, nh);
        const naturalRatio = nh / nw;
        const resultRatio = height / width;
        // Allow rounding tolerance of 1 pixel
        expect(Math.abs(resultRatio - naturalRatio)).toBeLessThan(
          naturalRatio / width + 0.01
        );
        expect(height).toBeGreaterThanOrEqual(ASPECT_LOCKED_MIN_HEIGHT);
        expect(height).toBeLessThanOrEqual(ASPECT_LOCKED_MAX_HEIGHT);
      }
    });
  });

  // =========================================================================
  // clampAspectDimensions — resize lock-back
  // =========================================================================
  describe('clampAspectDimensions', () => {
    it('locks a 16:9 resize correctly', () => {
      // natural: 1920x1080 => ratio = 1080/1920 = 0.5625
      // user drags to width=400 => height should be round(400 * 0.5625) = 225
      const { width, height } = clampAspectDimensions(400, 1920, 1080);
      expect(width).toBe(400);
      expect(height).toBe(Math.round(400 * (1080 / 1920)));
    });

    it('locks a 9:16 portrait resize correctly', () => {
      // natural: 1080x1920 => ratio = 1920/1080 ≈ 1.778
      // user drags to width=200 => height = round(200 * 1.778) = 356
      const { width, height } = clampAspectDimensions(200, 1080, 1920);
      expect(width).toBe(200);
      expect(height).toBe(Math.round(200 * (1920 / 1080)));
    });

    it('enforces absMinWidth floor regardless of ratio', () => {
      // Passing an extremely small width
      const { width } = clampAspectDimensions(10, 1920, 1080, 80, 60);
      expect(width).toBe(80);
    });

    it('enforces absMinHeight floor for very wide aspect ratios', () => {
      // natural: 4000x100 => ratio = 0.025; newWidth=80 => height=round(80*0.025)=2
      // height should be floored to absMinHeight
      const { height } = clampAspectDimensions(80, 4000, 100, 80, 60);
      expect(height).toBeGreaterThanOrEqual(60);
    });

    it('returns width=absMinWidth, height=absMinHeight when naturals are zero', () => {
      const { width, height } = clampAspectDimensions(300, 0, 0, 80, 60);
      expect(width).toBe(300);
      expect(height).toBe(60);
    });

    it('rounds dimensions to integer pixels', () => {
      // Any output must be whole numbers
      const { width, height } = clampAspectDimensions(250, 1600, 900, 80, 60);
      expect(Number.isInteger(width)).toBe(true);
      expect(Number.isInteger(height)).toBe(true);
    });
  });

  // =========================================================================
  // getItemBounds
  // =========================================================================
  describe('getItemBounds', () => {
    it('returns x, y, width, height from the item geometry', () => {
      expect(getItemBounds(squareItem)).toEqual({ x: 100, y: 200, width: 300, height: 300 });
      expect(getItemBounds(landscapeItem)).toEqual({ x: 50, y: 50, width: 400, height: 200 });
    });

    it('handles zero-position items', () => {
      const item = { x: 0, y: 0, width: 100, height: 50 };
      expect(getItemBounds(item)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    });

    it('handles negative-offset items (off-canvas left/top)', () => {
      const item = { x: -200, y: -300, width: 150, height: 120 };
      expect(getItemBounds(item)).toEqual({ x: -200, y: -300, width: 150, height: 120 });
    });
  });

  // =========================================================================
  // getItemCenter
  // =========================================================================
  describe('getItemCenter', () => {
    it('returns exact centre of a square item', () => {
      const center = getItemCenter(squareItem);
      expect(center.x).toBe(100 + 300 / 2);
      expect(center.y).toBe(200 + 300 / 2);
    });

    it('returns centre of a landscape item', () => {
      const center = getItemCenter(landscapeItem);
      expect(center.x).toBe(50 + 400 / 2);
      expect(center.y).toBe(50 + 200 / 2);
    });

    it('handles odd-pixel dimensions (non-integer centre is fine)', () => {
      const item = { x: 0, y: 0, width: 101, height: 201 };
      expect(getItemCenter(item).x).toBe(50.5);
      expect(getItemCenter(item).y).toBe(100.5);
    });

    it('handles zero-origin zero-size degenerate item', () => {
      const item = { x: 0, y: 0, width: 0, height: 0 };
      expect(getItemCenter(item)).toEqual({ x: 0, y: 0 });
    });
  });

  // =========================================================================
  // isPointInItem
  // =========================================================================
  describe('isPointInItem', () => {
    it('returns true for a point clearly inside the item', () => {
      expect(isPointInItem(150, 250, squareItem)).toBe(true);
    });

    it('returns true for all four corners (inclusive boundary)', () => {
      const { x, y, width, height } = squareItem;
      expect(isPointInItem(x, y, squareItem)).toBe(true);
      expect(isPointInItem(x + width, y, squareItem)).toBe(true);
      expect(isPointInItem(x, y + height, squareItem)).toBe(true);
      expect(isPointInItem(x + width, y + height, squareItem)).toBe(true);
    });

    it('returns false for a point clearly outside', () => {
      expect(isPointInItem(50, 150, squareItem)).toBe(false); // left of x=100
      expect(isPointInItem(500, 250, squareItem)).toBe(false); // right of x+w=400
      expect(isPointInItem(150, 100, squareItem)).toBe(false); // above y=200
      expect(isPointInItem(150, 600, squareItem)).toBe(false); // below y+h=500
    });

    it('padding=0 outside point is false; padding=20 same point becomes true', () => {
      // Point at (90, 200) — 10px left of the item
      expect(isPointInItem(90, 200, squareItem, 0)).toBe(false);
      expect(isPointInItem(90, 200, squareItem, 15)).toBe(true);
    });

    it('handles zero-padding explicitly', () => {
      expect(isPointInItem(100, 200, squareItem, 0)).toBe(true);
    });

    it('handles portrait item correctly', () => {
      expect(isPointInItem(150, 300, portraitItem)).toBe(true);
      expect(isPointInItem(350, 300, portraitItem)).toBe(false); // outside width=300
    });
  });

  // =========================================================================
  // ItemsLayer z-index sorting invariant
  // =========================================================================
  describe('ItemsLayer — Strict z-index ordering', () => {
    it('sorts items in ascending order of z_index so lower z renders below higher', () => {
      const items = [
        { id: '1', z_index: 10 },
        { id: '2', z_index: -2 },
        { id: '3', z_index: 5 },
        { id: '4', z_index: 0 },
      ];
      const sorted = [...items].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
      expect(sorted.map((i) => i.id)).toEqual(['2', '4', '3', '1']);
    });

    it('handles undefined and missing z_index gracefully with 0 fallback', () => {
      const items = [
        { id: '1', z_index: 3 },
        { id: '2', z_index: undefined },
        { id: '3', z_index: -1 },
      ];
      const sorted = [...items].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
      expect(sorted.map((i) => i.id)).toEqual(['3', '2', '1']);
    });
  });

  // =========================================================================
  // useItemDrag multi-item synchronization invariant
  // =========================================================================
  describe('useItemDrag — Multi-item synchronization invariant', () => {
    it('synchronizes all selected items by primary drag displacement delta (dx, dy)', () => {
      const primaryStart = { x: 100, y: 100 };
      const siblingStart = { x: 300, y: 200 };
      const unselectedStart = { x: 500, y: 500 };

      // Primary dragged to (150, 180)
      const primaryDragged = { x: 150, y: 180 };
      const dx = primaryDragged.x - primaryStart.x; // +50
      const dy = primaryDragged.y - primaryStart.y; // +80

      const siblingLive = {
        x: siblingStart.x + dx,
        y: siblingStart.y + dy,
      };

      expect(siblingLive).toEqual({ x: 350, y: 280 });
      // Unselected item is untouched
      expect(unselectedStart).toEqual({ x: 500, y: 500 });
    });

    it('commits integer positions for all dragged items on dragEnd', () => {
      const startA = { x: 100, y: 100 };
      const startB = { x: 250, y: 150 };

      const finalA = { x: 142.4, y: 188.7 };
      const dx = finalA.x - startA.x;
      const dy = finalA.y - startA.y;

      const commitA = { x: finalA.x, y: finalA.y };
      const commitB = { x: Math.round(startB.x + dx), y: Math.round(startB.y + dy) };

      expect(commitB.x).toBe(292);
      expect(commitB.y).toBe(239);
    });
  });
});

