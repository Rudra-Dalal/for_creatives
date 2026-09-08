'use client';

import { useState, useRef, useCallback } from 'react';
import type { AnchorPosition, MoodboardItem } from '../../types';
import type { CanvasPoint } from '../../coordinates/geometryTypes';
import { CLICK_VS_DRAG_THRESHOLD_PX, CORNER_PRIORITY_ZONE_PX } from '../../coordinates/constants';
import { findClosestCardinalAnchor, isPointInCornerProtectionZone } from '../geometry/anchorGeometry';

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
  /** Proximity padding around candidate items for magnetic anchor snapping (default: 24px). */
  snapProximityPadding?: number;
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
    candidateItems: MoodboardItem[]
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
 *     exceeds CLICK_VS_DRAG_THRESHOLD_PX (4px).
 *  2. Magnetic cardinal edge snapping: Snaps to candidate card anchors mathematically
 *     WITHOUT dynamically mounting 4 interactive DOM/Konva anchor listeners per item.
 *  3. Corner protection: Avoids anchor snapping when pointer is within the 20px
 *     corner priority zone where Transformer resize handles operate.
 *  4. Single authority: Completely encapsulates connectingFrom, connectingPointerPos,
 *     and connectingTarget state with synchronous ref backing.
 */
export function useConnectorDrag({
  onAddConnection,
  snapProximityPadding = 24,
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
    (pointerPos: CanvasPoint, candidateItems: MoodboardItem[]) => {
      const currentSource = connectingFromRef.current;
      if (!currentSource) return;

      // Evaluate 4px threshold
      if (!thresholdExceededRef.current && initialPointerPosRef.current) {
        const dx = pointerPos.x - initialPointerPosRef.current.x;
        const dy = pointerPos.y - initialPointerPosRef.current.y;
        if (Math.hypot(dx, dy) >= CLICK_VS_DRAG_THRESHOLD_PX) {
          thresholdExceededRef.current = true;
          setIsDragThresholdExceeded(true);
        }
      }

      connectingPointerPosRef.current = pointerPos;
      setConnectingPointerPos(pointerPos);

      // Magnetic snapping: evaluate proximity to other items purely mathematically
      let foundTarget: ConnectingTarget | null = null;

      for (const item of candidateItems) {
        if (item.id === currentSource.itemId) continue;
        if (item.type === 'stroke' || item.deleted_at) continue;

        const bounds = { x: item.x, y: item.y, width: item.width, height: item.height };
        const pad = snapProximityPadding;

        // Bounding box proximity check
        if (
          pointerPos.x >= bounds.x - pad &&
          pointerPos.x <= bounds.x + bounds.width + pad &&
          pointerPos.y >= bounds.y - pad &&
          pointerPos.y <= bounds.y + bounds.height + pad
        ) {
          // If within corner priority zone, do NOT snap to cardinal anchor
          // (allows Transformer corner resize handles to maintain priority)
          if (isPointInCornerProtectionZone(pointerPos, bounds, CORNER_PRIORITY_ZONE_PX)) {
            continue;
          }

          const closest = findClosestCardinalAnchor(pointerPos, bounds);
          foundTarget = {
            itemId: item.id,
            anchor: closest.anchor,
            snapPoint: closest.point,
          };
          break;
        }
      }

      connectingTargetRef.current = foundTarget;
      setConnectingTarget(foundTarget);
    },
    [snapProximityPadding]
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
