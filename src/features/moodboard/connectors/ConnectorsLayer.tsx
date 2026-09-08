'use client';

import React, { useMemo } from 'react';
import { Layer } from 'react-konva';
import type { ResolvedConnection, MoodboardItem } from '../types';
import { ConnectorLine } from './components/ConnectorLine';

export interface ConnectorsLayerProps {
  /** List of resolved connections across active moodboard items. */
  connections: ResolvedConnection[];
  /** Moodboard items for resolving source/target card coordinates. */
  items: MoodboardItem[];
  /** Currently selected connection ID, if any. */
  selectedConnectionId?: string | null;
  /** Canvas viewport zoom scale. */
  scale?: number;
  /** Authoritative live item positions during active dragging. */
  liveDragPositionsRef?: React.MutableRefObject<Map<string, { x: number; y: number }>>;
  /** Animation frame tick counter driving live drag updates. */
  liveDragTick?: number;
  /** Callback fired when a connector is selected. */
  onSelectConnection?: (connectionId: string) => void;
  /** Callback fired when a connector is deleted. */
  onDeleteConnection?: (connectionId: string) => void;
  /** Callback fired on double click to open the relationship label editor. */
  onDoubleClickConnection?: (connectionId: string, clientX: number, clientY: number) => void;
}

/**
 * ConnectorsLayer — Dedicated Konva Layer rendering all persistent moodboard connectors.
 *
 * Visual & Hit-Testing Hierarchy Contract:
 *  - This layer MUST be mounted directly beneath `ItemsLayer`.
 *  - Connectors visually route beneath card bodies and shadows.
 *  - Cards in `ItemsLayer` automatically receive pointer hit priority over underlying connectors.
 *  - Live elastic connection feedback and anchor handles live in `InteractionOverlayLayer` above items.
 *  - Follows moving cards in real time within the exact same RAF/update cycle via liveDragPositionsRef.
 */
export function ConnectorsLayer({
  connections,
  items,
  selectedConnectionId,
  scale = 1,
  liveDragPositionsRef,
  liveDragTick,
  onSelectConnection,
  onDeleteConnection,
  onDoubleClickConnection,
}: ConnectorsLayerProps) {
  void liveDragTick;
  const itemMap = useMemo(() => {
    return new Map<string, MoodboardItem>(items.map((i) => [i.id, i]));
  }, [items]);

  return (
    <Layer name="connectors-layer">
      {/* All persistent active connections */}
      {connections.map((conn) => {
        const sourceItem = itemMap.get(conn.fromId);
        const targetItem = itemMap.get(conn.targetId);
        if (!sourceItem || !targetItem) return null;

        const liveSrc = liveDragPositionsRef?.current?.get(conn.fromId);
        const liveTgt = liveDragPositionsRef?.current?.get(conn.targetId);

        return (
          <ConnectorLine
            key={conn.id}
            connection={conn}
            sourceItem={sourceItem}
            targetItem={targetItem}
            liveSourcePos={liveSrc}
            liveTargetPos={liveTgt}
            isSelected={selectedConnectionId === conn.id}
            scale={scale}
            onSelect={onSelectConnection}
            onDelete={onDeleteConnection}
            onDoubleClick={onDoubleClickConnection}
          />
        );
      })}
    </Layer>
  );
}
