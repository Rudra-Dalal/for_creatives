'use client';

import React, { useMemo } from 'react';
import { Layer, Arrow } from 'react-konva';
import type { ResolvedConnection, MoodboardItem } from '../types';
import { ConnectorLine } from './components/ConnectorLine';
import { calculateBezierCurve } from './geometry/bezierGeometry';
import type { UseConnectorDragReturn } from './interaction/useConnectorDrag';

export interface ConnectorsLayerProps {
  /** List of resolved connections across active moodboard items. */
  connections: ResolvedConnection[];
  /** Moodboard items for resolving source/target card coordinates. */
  items: MoodboardItem[];
  /** Currently selected connection ID, if any. */
  selectedConnectionId?: string | null;
  /** Canvas viewport zoom scale. */
  scale?: number;
  /** Authoritative connection drag controller. */
  drag: UseConnectorDragReturn;
  /** Callback fired when a connector is selected. */
  onSelectConnection?: (connectionId: string) => void;
  /** Callback fired when a connector is deleted. */
  onDeleteConnection?: (connectionId: string) => void;
  /** Callback fired on double click to open the relationship label editor. */
  onDoubleClickConnection?: (connectionId: string, clientX: number, clientY: number) => void;
}

/**
 * ConnectorsLayer — Dedicated Konva Layer rendering all moodboard connectors.
 *
 * Visual & Hit-Testing Hierarchy Contract:
 *  - This layer MUST be mounted directly beneath `ItemsLayer`.
 *  - Connectors visually route beneath card bodies and shadows.
 *  - Cards in `ItemsLayer` automatically receive pointer hit priority over underlying connectors.
 *  - Renders live elastic feedback during connection creation.
 */
export function ConnectorsLayer({
  connections,
  items,
  selectedConnectionId,
  scale = 1,
  drag,
  onSelectConnection,
  onDeleteConnection,
  onDoubleClickConnection,
}: ConnectorsLayerProps) {
  const itemMap = useMemo(() => {
    return new Map<string, MoodboardItem>(items.map((i) => [i.id, i]));
  }, [items]);

  const zoomDivisor = Math.max(0.4, scale);

  const { connectingFrom, connectingPointerPos, connectingTarget, isDragThresholdExceeded } = drag;

  // Compute live points for the drag-to-connect elastic line
  const liveElasticPoints = useMemo(() => {
    if (!connectingFrom || !connectingPointerPos) return null;

    if (connectingTarget) {
      // Snapped to candidate anchor -> render live preview Bezier curve
      const curve = calculateBezierCurve(
        connectingFrom.startPoint,
        connectingTarget.snapPoint,
        connectingFrom.anchor,
        connectingTarget.anchor
      );
      return {
        points: curve.points,
        bezier: true,
      };
    }

    // Free elastic dragging -> render straight elastic line to pointer
    return {
      points: [
        connectingFrom.startPoint.x,
        connectingFrom.startPoint.y,
        connectingPointerPos.x,
        connectingPointerPos.y,
      ],
      bezier: false,
    };
  }, [connectingFrom, connectingPointerPos, connectingTarget]);

  return (
    <Layer name="connectors-layer">
      {/* All persistent active connections */}
      {connections.map((conn) => {
        const sourceItem = itemMap.get(conn.fromId);
        const targetItem = itemMap.get(conn.targetId);
        if (!sourceItem || !targetItem) return null;

        return (
          <ConnectorLine
            key={conn.id}
            connection={conn}
            sourceItem={sourceItem}
            targetItem={targetItem}
            isSelected={selectedConnectionId === conn.id}
            scale={scale}
            onSelect={onSelectConnection}
            onDelete={onDeleteConnection}
            onDoubleClick={onDoubleClickConnection}
          />
        );
      })}

      {/* Live Elastic Drag-to-Connect Arrow (activates only after 4px threshold) */}
      {drag.isConnecting && liveElasticPoints && isDragThresholdExceeded && (
        <Arrow
          points={liveElasticPoints.points}
          bezier={liveElasticPoints.bezier}
          stroke="#D97706"
          fill="#D97706"
          strokeWidth={2 / zoomDivisor}
          dash={[6 / zoomDivisor, 4 / zoomDivisor]}
          pointerLength={8 / zoomDivisor}
          pointerWidth={6 / zoomDivisor}
          listening={false}
        />
      )}
    </Layer>
  );
}
