import type { CanvasBounds } from '../coordinates';

/**
 * Canonical item type discriminant. Matches the moodboard_items.type column enum.
 * `stroke` items are excluded from aspect-ratio logic and dimension defaults
 * because their bounding box is computed from drawn points, not from defaults.
 */
export type ItemType = 'reference' | 'image' | 'text' | 'color' | 'idea' | 'stroke';

/**
 * Item types for which a natural (image) aspect ratio must be locked during
 * placement and resize. These are the only two types that call getImageNaturalDimensions
 * before placement and that use keepRatio=true on the Konva Transformer.
 */
export type AspectLockedItemType = Extract<ItemType, 'reference' | 'image'>;

/**
 * Lightweight geometry contract representing a placed canvas item's position
 * and dimensions. Intentionally free of content, z-index, or DB concerns.
 */
export interface ItemGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Default placement dimensions per item type.
 *
 * These are the authoritative single source of truth extracted from the
 * duplicated constants previously scattered across useMoodboard.ts.
 *
 * reference/image: 300x220 fallback (overridden by aspect math when dims are known)
 * text:            240x160
 * color:           180x180  (square swatch)
 * idea:            280x180
 * stroke:          has no meaningful default — bounding box is drawn, not placed.
 */
export const ITEM_DEFAULT_DIMENSIONS: Record<ItemType, { width: number; height: number }> = {
  reference: { width: 300, height: 220 },
  image:     { width: 300, height: 220 },
  text:      { width: 240, height: 160 },
  color:     { width: 180, height: 180 },
  idea:      { width: 280, height: 180 },
  stroke:    { width: 0,   height: 0   },
};

/**
 * Minimum canvas dimensions enforced for aspect-locked items (reference/image)
 * during both initial placement and Transformer resize.
 */
export const ASPECT_LOCKED_MIN_HEIGHT = 120;
export const ASPECT_LOCKED_MAX_HEIGHT = 400;
export const ASPECT_LOCKED_DEFAULT_WIDTH = 300;

/**
 * Absolute minimum canvas dimensions enforced by the Konva Transformer
 * boundBoxFunc across all item types (excluding strokes).
 * Centralised here so both pure logic and the Transformer component reference
 * the same constants.
 */
export const TRANSFORMER_MIN_WIDTH = 40;
export const TRANSFORMER_MIN_HEIGHT = 30;

/**
 * Alias for CanvasBounds — returned by getItemBounds for explicit intent.
 */
export type ItemBounds = CanvasBounds;
