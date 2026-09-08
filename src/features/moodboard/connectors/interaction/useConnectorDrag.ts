'use client';

import { useState, useRef, useCallback } from 'react';
import type { AnchorPosition, MoodboardItem } from '../../types';
import type { CanvasPoint } from '../../coordinates/geometryTypes';
import { CLICK_VS_DRAG_THRESHOLD_PX, CONNECTOR_SNAP_PROXIMITY_PX } from '../../coordinates/constants';
import { findClosestCardinalAnchor } from '../geometry/anchorGeometry';

export interface ConnectingSource {
  itemId: string;
  anchor: AnchorPosition;
  startPoint: CanvasPoint;
}

export interface ConnectingTarget {
  itemId: string;
  anchor: AnchorPosition;
  snapPoint: CanvasPoint;
}

export interface UseConnectorDragOptions {
  /** Callback fired when a valid connection is successfully completed. */
  onAddConnection?: (
    fromId: string,
    targetId: string,
    fromAnchor: AnchorPosition,
    toAnchor: AnchorPosition
  ) => void;
  /** Screen-space proximity envelope around candidate items for magnetic anchor snapping (default: 28px). */
  snapProximityPx?: number;
}

export interface UseConnectorDragReturn {
  /** Active source item and starting anchor point, or null if not connecting. */
  connectingFrom: ConnectingSource | null;
  /** Current canvas world position of the drag pointer. */
  connectingPointerPos: CanvasPoint | null;
  /** Magnetically snapped candidate target item and anchor, if hovering near a candidate. */
  connectingTarget: ConnectingTarget | null;
  /** Whether a connection drag is currently active. */
  isConnecting: boolean;
  /** Whether the drag movement has exceeded the authoritative CLICK_VS_DRAG_THRESHOLD_PX (4px). */
  isDragThresholdExceeded: boolean;
  /** Initiates connection drag from a specific item cardinal anchor. */
  startConnecting: (
    itemId: string,
    anchor: AnchorPosition,
    startPoint: CanvasPoint,
    pointerPos?: CanvasPoint
  ) => void;
  /** Updates the live elastic line and computes magnetic snapping against candidate items. */
  updateConnecting: (
    pointerPos: CanvasPoint,
    candidateItems: MoodboardItem[],
    scale?: number
  ) => void;
  /** Finalizes the connection drag and commits the new connection if a valid target is snapped. */
  finishConnecting: () => boolean;
  /** Cancels the connection drag without creating a connection. */
  cancelConnecting: () => void;
}

/**
 * useConnectorDrag — Single authoritative controller for connector drag-and-drop interactions.
 *
 * Interaction Contracts:
 *  1. Authoritative threshold: Live connection line activates only after pointer movement
 *     exceeds CLICK_VS_DRAG_THRESHOLD_PX (4px screen space).
 *  2. Magnetic cardinal edge snapping: Snaps to candidate card anchors mathematically
 *     WITHOUT dynamically mounting 4 interactive DOM/Konva anchor listeners per item.
 *  3. Screen-space envelope: Uses CONNECTOR_SNAP_PROXIMITY_PX (28px screen space) converted
 *     to canvas world distance via viewport scale.
 *  4. Corner protection: Respects CORNER_PRIORITY_ZONE_PX (20px screen space) to ensure
 *     Transformer corner resize handles retain absolute priority.
 *  5. Single authority: Encapsulates connectingFrom, connectingPointerPos, and connectingTarget
 *     with synchronous ref backing.
 */
export function useConnectorDrag({
  onAddConnection,
  snapProximityPx = CONNECTOR_SNAP_PROXIMITY_PX,
}: UseConnectorDragOptions = {}): UseConnectorDragReturn {
  const [connectingFrom, setConnectingFrom] = useState<ConnectingSource | null>(null);
  const [connectingPointerPos, setConnectingPointerPos] = useState<CanvasPoint | null>(null);
  const [connectingTarget, setConnectingTarget] = useState<ConnectingTarget | null>(null);
  const [isDragThresholdExceeded, setIsDragThresholdExceeded] = useState<boolean>(false);

  // Ref backing for synchronous immediate updates and test harness compatibility
  const connectingFromRef = useRef<ConnectingSource | null>(null);
  const connectingPointerPosRef = useRef<CanvasPoint | null>(null);
  const connectingTargetRef = useRef<ConnectingTarget | null>(null);
  const thresholdExceededRef = useRef<boolean>(false);
  const initialPointerPosRef = useRef<CanvasPoint | null>(null);

  const startConnecting = useCallback(
    (
      itemId: string,
      anchor: AnchorPosition,
      startPoint: CanvasPoint,
      pointerPos?: CanvasPoint
    ) => {
      const initial = pointerPos || startPoint;
      const source: ConnectingSource = { itemId, anchor, startPoint };

      initialPointerPosRef.current = initial;
      thresholdExceededRef.current = false;
      connectingFromRef.current = source;
      connectingPointerPosRef.current = initial;
      connectingTargetRef.current = null;

      setIsDragThresholdExceeded(false);
      setConnectingFrom(source);
      setConnectingPointerPos(initial);
      setConnectingTarget(null);
    },
    []
  );

  const updateConnecting = useCallback(
    (pointerPos: CanvasPoint, candidateItems: MoodboardItem[], scale = 1) => {
      const currentSource = connectingFromRef.current;
      if (!currentSource) return;

      // Evaluate 4px screen-space threshold
      if (!thresholdExceededRef.current && initialPointerPosRef.current) {
        const dxScreen = (pointerPos.x - initialPointerPosRef.current.x) * scale;
        const dyScreen = (pointerPos.y - initialPointerPosRef.current.y) * scale;
        if (Math.hypot(dxScreen, dyScreen) >= CLICK_VS_DRAG_THRESHOLD_PX) {
          thresholdExceededRef.current = true;
          setIsDragThresholdExceeded(true);
        }
      }

      connectingPointerPosRef.current = pointerPos;
      setConnectingPointerPos(pointerPos);

      // Magnetic snapping: evaluate proximity to other items purely mathematically
      let foundTarget: ConnectingTarget | null = null;
      let minDistance = Infinity;

      for (const item of candidateItems) {
        if (item.id === currentSource.itemId) continue;
        if (item.type === 'stroke' || item.deleted_at) continue;

        const bounds = { x: item.x, y: item.y, width: item.width, height: item.height };

        // findClosestCardinalAnchor converts snapProximityPx and corner protection to world units via scale
        const closest = findClosestCardinalAnchor(pointerPos, bounds, scale, snapProximityPx);
        if (closest && closest.distance < minDistance) {
          minDistance = closest.distance;
          foundTarget = {
            itemId: item.id,
            anchor: closest.anchor,
            snapPoint: closest.point,
          };
        }
      }

      connectingTargetRef.current = foundTarget;
      setConnectingTarget(foundTarget);
    },
    [snapProximityPx]
  );

  const finishConnecting = useCallback((): boolean => {
    const currentSource = connectingFromRef.current;
    const currentTarget = connectingTargetRef.current;
    const wasThresholdMet = thresholdExceededRef.current;

    let created = false;

    if (currentSource && currentTarget && wasThresholdMet && onAddConnection) {
      onAddConnection(
        currentSource.itemId,
        currentTarget.itemId,
        currentSource.anchor,
        currentTarget.anchor
      );
      created = true;
    }

    connectingFromRef.current = null;
    connectingPointerPosRef.current = null;
    connectingTargetRef.current = null;
    initialPointerPosRef.current = null;
    thresholdExceededRef.current = false;

    setConnectingFrom(null);
    setConnectingPointerPos(null);
    setConnectingTarget(null);
    setIsDragThresholdExceeded(false);

    return created;
  }, [onAddConnection]);

  const cancelConnecting = useCallback(() => {
    connectingFromRef.current = null;
    connectingPointerPosRef.current = null;
    connectingTargetRef.current = null;
    initialPointerPosRef.current = null;
    thresholdExceededRef.current = false;

    setConnectingFrom(null);
    setConnectingPointerPos(null);
    setConnectingTarget(null);
    setIsDragThresholdExceeded(false);
  }, []);

  return {
    get connectingFrom() {
      return connectingFromRef.current ?? connectingFrom;
    },
    get connectingPointerPos() {
      return connectingPointerPosRef.current ?? connectingPointerPos;
    },
    get connectingTarget() {
      return connectingTargetRef.current ?? connectingTarget;
    },
    get isConnecting() {
      return connectingFromRef.current !== null;
    },
    get isDragThresholdExceeded() {
      return thresholdExceededRef.current;
    },
    startConnecting,
    updateConnecting,
    finishConnecting,
    cancelConnecting,
  };
}
