'use client';

import { useCallback } from 'react';
import type Konva from 'konva';
import type { MoodboardItem } from '../types';
import type { TransformBox } from './selectionTypes';
import {
  TRANSFORMER_MIN_WIDTH,
  TRANSFORMER_MIN_HEIGHT,
  ASPECT_LOCKED_MIN_HEIGHT,
  ASPECT_LOCKED_MAX_HEIGHT,
} from '../items/itemTypes';
import {
  isAspectLocked,
  clampAspectDimensions,
} from '../items/canvasItemPure';

export interface UseItemTransformOptions {
  /** Callback to record undo action upon resize completion. */
  onRecordUndoAction?: (action: {
    type: 'RESIZE';
    itemId: string;
    prevGeometry: { x: number; y: number; width: number; height: number; zIndex?: number };
    nextGeometry: { x: number; y: number; width: number; height: number; zIndex?: number };
  }) => void;
  /** Callback to update local state immediately. */
  onUpdateItemLocal?: (id: string, updates: Partial<Pick<MoodboardItem, 'x' | 'y' | 'width' | 'height'>>) => void;
  /** Callback to persist final geometry to storage. */
  onPersistGeometry?: (id: string, geometry: { x: number; y: number; width: number; height: number; zIndex?: number }) => void;
}

/**
 * Pure calculation for Transformer boundBoxFunc.
 * Enforces minimum bounds and natural aspect ratio constraints.
 */
export function calculateTransformedBounds<T extends TransformBox>(
  oldBox: T,
  newBox: T,
  keepRatio = false
): T {
  // Enforce absolute minimum transformer dimensions across all items
  if (newBox.width < TRANSFORMER_MIN_WIDTH || newBox.height < TRANSFORMER_MIN_HEIGHT) {
    return oldBox;
  }

  // If aspect ratio is enforced (reference / image items)
  if (keepRatio) {
    const ratio = oldBox.height / Math.max(1, oldBox.width);
    let targetWidth = newBox.width;
    let targetHeight = targetWidth * ratio;

    // Clamp height into approved aspect-locked bounds
    if (targetHeight < ASPECT_LOCKED_MIN_HEIGHT) {
      targetHeight = ASPECT_LOCKED_MIN_HEIGHT;
      targetWidth = targetHeight / ratio;
    } else if (targetHeight > ASPECT_LOCKED_MAX_HEIGHT) {
      targetHeight = ASPECT_LOCKED_MAX_HEIGHT;
      targetWidth = targetHeight / ratio;
    }

    return {
      ...newBox,
      width: Math.round(targetWidth),
      height: Math.round(targetHeight),
    };
  }

  return newBox;
}

/**
 * Hook providing resize bounding box validation and transform completion handling.
 */
export function useItemTransform({
  onRecordUndoAction,
  onUpdateItemLocal,
  onPersistGeometry,
}: UseItemTransformOptions = {}) {
  /**
   * Generates a boundBoxFunc for a given item or set of items.
   */
  const getBoundBoxFunc = useCallback(
    (keepRatio = false) => {
      return (oldBox: TransformBox, newBox: TransformBox): TransformBox => {
        return calculateTransformedBounds(oldBox, newBox, keepRatio);
      };
    },
    []
  );

  /**
   * Authoritative handler for when a transform (resize) gesture ends on an item.
   * Normalizes scale to 1, updates item dimensions, persists to storage, and records undo.
   */
  const handleTransformEnd = useCallback(
    (
      node: Konva.Node,
      item: MoodboardItem,
      naturalDimensions?: { width: number; height: number } | null
    ) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset scale to 1 on the Konva node
      node.scaleX(1);
      node.scaleY(1);

      const rawWidth = Math.max(TRANSFORMER_MIN_WIDTH, Math.round(node.width() * scaleX));
      let finalWidth = rawWidth;
      let finalHeight = Math.max(TRANSFORMER_MIN_HEIGHT, Math.round(node.height() * scaleY));

      // If aspect locked, preserve the natural aspect ratio
      if (isAspectLocked(item.type)) {
        const natW = naturalDimensions && naturalDimensions.width > 0 ? naturalDimensions.width : item.width;
        const natH = naturalDimensions && naturalDimensions.height > 0 ? naturalDimensions.height : item.height;
        const clamped = clampAspectDimensions(
          rawWidth,
          natW,
          natH,
          TRANSFORMER_MIN_WIDTH,
          TRANSFORMER_MIN_HEIGHT
        );
        finalWidth = clamped.width;
        finalHeight = clamped.height;
      }

      node.width(finalWidth);
      node.height(finalHeight);

      const finalX = Math.round(node.x());
      const finalY = Math.round(node.y());

      const prevGeometry = {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.z_index,
      };

      const nextGeometry = {
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
        zIndex: item.z_index,
      };

      onUpdateItemLocal?.(item.id, {
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
      });

      onPersistGeometry?.(item.id, nextGeometry);

      if (
        prevGeometry.x !== nextGeometry.x ||
        prevGeometry.y !== nextGeometry.y ||
        prevGeometry.width !== nextGeometry.width ||
        prevGeometry.height !== nextGeometry.height
      ) {
        onRecordUndoAction?.({
          type: 'RESIZE',
          itemId: item.id,
          prevGeometry,
          nextGeometry,
        });
      }
    },
    [onRecordUndoAction, onUpdateItemLocal, onPersistGeometry]
  );

  return {
    getBoundBoxFunc,
    handleTransformEnd,
  };
}
