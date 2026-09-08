'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem } from '../types';
import { calculateTransformedBounds } from './useItemTransform';
import { isAspectLocked } from '../items/canvasItemPure';

export interface CanvasTransformerProps {
  /** Single active node (legacy or single selection). */
  selectedNode?: Konva.Node | null;
  /** Array of active selected Konva nodes. */
  selectedNodes?: Konva.Node[];
  /** Associated items to determine type and aspect-ratio constraints. */
  items?: MoodboardItem[];
  /** Explicit override for keeping aspect ratio. */
  keepRatio?: boolean;
}

/**
 * Isolated Konva Transformer component for item resizing.
 *
 * Architectural Invariants:
 * 1. Corner handle priority: Only corner anchors ('top-left', 'top-right', 'bottom-left', 'bottom-right')
 *    are enabled, ensuring clean isolation from cardinal connector anchors which occupy edge centers.
 * 2. Bounds enforcement: Uses calculateTransformedBounds to strictly enforce TRANSFORMER_MIN_WIDTH (40)
 *    and TRANSFORMER_MIN_HEIGHT (30).
 * 3. Aspect-ratio preservation: Automatically enables keepRatio whenever a reference or image item is selected.
 * 4. Stroke exclusion: Strokes are freehand vector paths and are strictly excluded from box transformation.
 */
export function CanvasTransformer({
  selectedNode,
  selectedNodes,
  items = [],
  keepRatio: explicitKeepRatio,
}: CanvasTransformerProps) {
  const transformerRef = useRef<Konva.Transformer | null>(null);

  // Filter out stroke items and invalid nodes
  const activeNodes = useMemo(() => {
    const rawNodes = selectedNodes && selectedNodes.length > 0
      ? selectedNodes
      : selectedNode
      ? [selectedNode]
      : [];

    return rawNodes.filter((node) => {
      if (!node) return false;
      const itm = items.find((i) => i.id === node.id());
      // Strokes are never transformable via box resize
      if (itm && itm.type === 'stroke') return false;
      return true;
    });
  }, [selectedNode, selectedNodes, items]);

  // Determine whether any selected item requires aspect ratio locking
  const shouldKeepRatio = useMemo(() => {
    if (explicitKeepRatio !== undefined) return explicitKeepRatio;
    return activeNodes.some((node) => {
      const itm = items.find((i) => i.id === node.id());
      return itm ? isAspectLocked(itm.type) : false;
    });
  }, [explicitKeepRatio, activeNodes, items]);

  // Sync active nodes to the Konva Transformer instance
  useEffect(() => {
    if (!transformerRef.current) return;
    transformerRef.current.nodes(activeNodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [activeNodes]);

  if (activeNodes.length === 0) return null;

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox, newBox) => {
        return calculateTransformedBounds(oldBox, newBox, shouldKeepRatio);
      }}
      keepRatio={shouldKeepRatio}
      // Corner-only anchors guarantee isolation from cardinal anchors
      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
      shiftBehavior={shouldKeepRatio ? 'none' : 'inverted'}
      rotateEnabled={false}
      borderStroke="#f59e0b"
      borderStrokeWidth={1.5}
      anchorFill="#f59e0b"
      anchorStroke="#181816"
      anchorStrokeWidth={1.5}
      anchorSize={8}
      anchorCornerRadius={2}
      padding={0}
      ignoreStroke={true}
      shouldOverdrawWholeArea={false}
    />
  );
}
