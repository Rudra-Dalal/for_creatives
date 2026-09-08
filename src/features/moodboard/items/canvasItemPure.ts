import type { ItemType, ItemGeometry, ItemBounds } from './itemTypes';
import {
  ITEM_DEFAULT_DIMENSIONS,
  ASPECT_LOCKED_MIN_HEIGHT,
  ASPECT_LOCKED_MAX_HEIGHT,
  ASPECT_LOCKED_DEFAULT_WIDTH,
} from './itemTypes';

/**
 * Returns true if the given item type enforces natural-image aspect ratio locking
 * during placement and resize. Only `reference` and `image` types qualify.
 */
export function isAspectLocked(type: ItemType): boolean {
  return type === 'reference' || type === 'image';
}

/**
 * Returns the authoritative default placement dimensions for a given item type.
 * For `stroke` items the returned dimensions are {0, 0}; callers must handle
 * that sentinel value (stroke bounding boxes are computed from drawn points).
 */
export function resolveDefaultDimensions(type: ItemType): { width: number; height: number } {
  return { ...ITEM_DEFAULT_DIMENSIONS[type] };
}

/**
 * Computes the initial canvas dimensions for an aspect-locked item (`reference`
 * or `image`) given the image's natural pixel dimensions.
 *
 * Algorithm:
 *  1. Compute aspect ratio = naturalHeight / naturalWidth  (portrait > 1, landscape < 1)
 *  2. Start from ASPECT_LOCKED_DEFAULT_WIDTH (300px).
 *  3. Clamp height into [ASPECT_LOCKED_MIN_HEIGHT, ASPECT_LOCKED_MAX_HEIGHT] while
 *     recomputing width to strictly preserve the ratio whenever height is clamped.
 *
 * This is a pure extraction of the logic duplicated in addReferenceItem and
 * addImageItem inside useMoodboard.ts.
 *
 * Returns the default fallback ({300, 220}) when naturalWidth or naturalHeight
 * are zero or negative (image dimensions unavailable / not yet loaded).
 *
 * @param naturalWidth  - Raw image width in pixels from HTMLImageElement.naturalWidth
 * @param naturalHeight - Raw image height in pixels from HTMLImageElement.naturalHeight
 * @param targetWidth   - Starting canvas width; defaults to ASPECT_LOCKED_DEFAULT_WIDTH
 * @param minHeight     - Minimum clamped height; defaults to ASPECT_LOCKED_MIN_HEIGHT
 * @param maxHeight     - Maximum clamped height; defaults to ASPECT_LOCKED_MAX_HEIGHT
 */
export function resolveAspectLockedDimensions(
  naturalWidth: number,
  naturalHeight: number,
  targetWidth: number = ASPECT_LOCKED_DEFAULT_WIDTH,
  minHeight: number = ASPECT_LOCKED_MIN_HEIGHT,
  maxHeight: number = ASPECT_LOCKED_MAX_HEIGHT
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { ...ITEM_DEFAULT_DIMENSIONS['reference'] };
  }

  const aspectRatio = naturalHeight / naturalWidth;
  let w = targetWidth;
  let h = Math.round(w * aspectRatio);

  if (h > maxHeight) {
    h = maxHeight;
    w = Math.round(h / aspectRatio);
  } else if (h < minHeight) {
    h = minHeight;
    w = Math.round(h / aspectRatio);
  }

  return { width: w, height: h };
}

/**
 * Clamps a freely-resized width/height pair to the canonical aspect ratio
 * derived from the item's stored natural dimensions.
 *
 * Used in CanvasReferenceItem and CanvasImageItem handleTransformEnd to snap
 * the Konva Transformer's output back to the correct ratio after the user
 * releases the resize handle.
 *
 * When naturalWidth or naturalHeight are unavailable (0 / negative), the
 * function returns the input width and height unchanged.
 *
 * @param newWidth      - Post-transform width (scale already baked in)
 * @param naturalWidth  - Stored originalWidth from item content (or image.naturalWidth)
 * @param naturalHeight - Stored originalHeight from item content (or image.naturalHeight)
 * @param absMinWidth   - Hard floor for the returned width; defaults to 80
 * @param absMinHeight  - Hard floor for the returned height; defaults to 60
 */
export function clampAspectDimensions(
  newWidth: number,
  naturalWidth: number,
  naturalHeight: number,
  absMinWidth = 80,
  absMinHeight = 60
): { width: number; height: number } {
  const w = Math.max(absMinWidth, Math.round(newWidth));

  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: w, height: absMinHeight };
  }

  const ratio = naturalHeight / naturalWidth;
  const h = Math.max(absMinHeight, Math.round(w * ratio));

  return { width: w, height: h };
}

/**
 * Returns the canonical CanvasBounds for any object that satisfies ItemGeometry.
 * This is the items-module peer of calculateItemBounds from the coordinates module
 * but is scoped to the items contract and avoids a cross-module dependency inversion.
 */
export function getItemBounds(item: ItemGeometry): ItemBounds {
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  };
}

/**
 * Returns the canvas-space centre point of an item's bounding box.
 * Used by connector anchor midpoint math and zoom-to-fit centroid calculations.
 */
export function getItemCenter(item: ItemGeometry): { x: number; y: number } {
  return {
    x: item.x + item.width / 2,
    y: item.y + item.height / 2,
  };
}

/**
 * Checks whether a canvas-space point lies within an item's bounding box,
 * with an optional padding expansion.
 *
 * The padding argument is in canvas units (not screen pixels). Callers that
 * need screen-constant hit padding should pre-divide by the viewport scale
 * using getScreenScaledPadding from the coordinates module.
 */
export function isPointInItem(
  px: number,
  py: number,
  item: ItemGeometry,
  padding = 0
): boolean {
  return (
    px >= item.x - padding &&
    px <= item.x + item.width + padding &&
    py >= item.y - padding &&
    py <= item.y + item.height + padding
  );
}
