'use client';

import React, { useCallback } from 'react';
import type Konva from 'konva';
import type { MoodboardItem } from '../types';
import { ReferenceCard } from './cards/ReferenceCard';
import { ImageCard } from './cards/ImageCard';
import { TextCard } from './cards/TextCard';
import { ColorCard } from './cards/ColorCard';
import { IdeaCard } from './cards/IdeaCard';
import { StrokeItem } from './cards/StrokeItem';
import type { UseItemDragReturn } from './useItemDrag';

export interface ItemsLayerProps {
  /** All visible items, unsorted. ItemsLayer enforces z-index order. */
  items: MoodboardItem[];
  /** Currently selected item IDs. */
  selectedIds: string[];
  /** Whether the canvas is in read-only mode. */
  readOnly: boolean;
  /** Whether the active tool allows dragging (only 'select' tool). */
  isDraggingEnabled: boolean;
  /** Share token for proxied image URLs. */
  shareToken?: string;
  /** Map of reference_id -> linked direction count for the direction badge. */
  referenceDirectionCounts?: Map<string, number>;

  // ── Drag controller (from useItemDrag) ───────────────────────────────────
  drag: UseItemDragReturn;

  // ── Selection callbacks ───────────────────────────────────────────────────
  onPointerDown: (id: string, node: Konva.Node) => void;
  onSelect: (id: string, node: Konva.Node) => void;

  // ── Transform end ─────────────────────────────────────────────────────────
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;

  // ── Double-click edit openers ─────────────────────────────────────────────
  onDoubleClickText: (item: MoodboardItem) => void;
  onDoubleClickColor: (item: MoodboardItem) => void;
  onDoubleClickIdea: (item: MoodboardItem) => void;

  // ── Direction inspection ──────────────────────────────────────────────────
  onInspectDirection?: (referenceId: string) => void;
}

/**
 * ItemsLayer — renders all moodboard canvas items in strict z-index order.
 *
 * Responsibilities:
 *  - Sort items by z_index before rendering (single authoritative sort).
 *  - Apply live drag position overrides from useItemDrag.liveDragPositionsRef.
 *  - Route each item type to the appropriate focused card renderer.
 *  - Wire drag/select callbacks uniformly across all types.
 *
 * Intentionally contains no drag, selection, or geometry logic — those
 * live in useItemDrag and the pure items module respectively.
 */
export function ItemsLayer({
  items,
  selectedIds,
  readOnly,
  isDraggingEnabled,
  shareToken,
  referenceDirectionCounts,
  drag,
  onPointerDown,
  onSelect,
  onTransformEnd,
  onDoubleClickText,
  onDoubleClickColor,
  onDoubleClickIdea,
  onInspectDirection,
}: ItemsLayerProps) {
  // Stable live-bounds resolver: merges drag-live positions into items
  // without mutating the items array. Re-evaluated when liveDragTick increments.
  const { liveDragPositionsRef, liveDragTick } = drag;
  const getLiveBounds = useCallback(
    (item: MoodboardItem): MoodboardItem => {
      if (liveDragTick < 0) return item;
      const live = liveDragPositionsRef.current.get(item.id);
      return live ? { ...item, x: live.x, y: live.y } : item;
    },
    [liveDragPositionsRef, liveDragTick]
  );

  // Strict z-index sort (ascending — lower z_index renders below higher)
  const sortedItems = React.useMemo(
    () => [...items].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0)),
    [items]
  );

  const isDraggable = !readOnly && isDraggingEnabled;

  return (
    <>
      {sortedItems.map((rawItem) => {
        const item = getLiveBounds(rawItem);
        const isSelected = selectedIds.includes(item.id);

        const commonProps = {
          item,
          isSelected,
          isDraggable,
          onPointerDown: (node: Konva.Node) => onPointerDown(item.id, node),
          onSelect: (node: Konva.Node) => onSelect(item.id, node),
          onDragStart: () => drag.handleItemDragStart(item),
          onDragEnd: drag.handleItemDragEnd,
        };

        if (item.type === 'stroke') {
          return (
            <StrokeItem
              key={item.id}
              {...commonProps}
            />
          );
        }

        if (item.type === 'text') {
          return (
            <TextCard
              key={item.id}
              {...commonProps}
              onTransformEnd={onTransformEnd}
              onDoubleClick={onDoubleClickText}
            />
          );
        }

        if (item.type === 'image') {
          return (
            <ImageCard
              key={item.id}
              {...commonProps}
              shareToken={shareToken}
              onTransformEnd={onTransformEnd}
              onDimensionsCorrected={drag.handleDimensionsCorrected}
            />
          );
        }

        if (item.type === 'color') {
          return (
            <ColorCard
              key={item.id}
              {...commonProps}
              onTransformEnd={onTransformEnd}
              onDoubleClick={onDoubleClickColor}
            />
          );
        }

        if (item.type === 'idea') {
          return (
            <IdeaCard
              key={item.id}
              {...commonProps}
              onTransformEnd={onTransformEnd}
              onDoubleClick={onDoubleClickIdea}
            />
          );
        }

        // Default: reference item
        const linkedCount =
          item.reference_id && referenceDirectionCounts
            ? (referenceDirectionCounts.get(item.reference_id) ?? 0)
            : 0;

        return (
          <ReferenceCard
            key={item.id}
            {...commonProps}
            shareToken={shareToken}
            linkedDirectionsCount={linkedCount}
            onTransformEnd={onTransformEnd}
            onDimensionsCorrected={drag.handleDimensionsCorrected}
            onInspectDirection={onInspectDirection}
          />
        );
      })}
    </>
  );
}
