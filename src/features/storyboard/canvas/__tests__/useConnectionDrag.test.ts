/**
 * useConnectionDrag — Interaction Tests
 *
 * Tests the full lifecycle of sequence connection drag & drop:
 * 1. Starting a connection from an anchor handle in 'connect' tool
 * 2. Rejecting drag initiation when activeTool is not 'connect'
 * 3. Tracking pointer moves in world coordinates
 * 4. Magnetic snapping to candidate shot anchors
 * 5. Rejection of self-connection snap
 * 6. Rejection of duplicate connection snap
 * 7. Committing connection on mouseup on valid snap target
 * 8. Silent cancellation on empty canvas mouseup
 * 9. Explicit cancellation via cancelDrag
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import type Konva from 'konva';
import { useConnectionDrag } from '../useConnectionDrag';
import type { UseConnectionDragOptions } from '../useConnectionDrag';
import { getShotAnchorPoint } from '../../utils/storyboardConnections';
import type { StoryboardShotWithLinks, StoryboardShotConnection } from '../../types';

function createMockShot(
  id: string,
  x: number,
  y: number,
  width = 320,
  height = 180
): StoryboardShotWithLinks {
  return {
    id,
    project_id: 'p1',
    scene_id: 's1',
    aspect_ratio: '16:9',
    x,
    y,
    width,
    height,
    title: `Shot ${id}`,
    description: '',
    shot_number: '1',
    dialogue: '',
    shot_type: null,
    camera_movement: null,
    visual_url: '',
    visual_source: 'none',
    sketch_data: null,
    z_index: 0,
    display_order: 1,
    deleted_at: null,
    created_at: '2026-09-18T00:00:00Z',
    updated_at: '2026-09-18T00:00:00Z',
    references: [],
    direction_notes: [],
  };
}

function createMockKonvaEvent(pointerPos: { x: number; y: number } | null = null) {
  return {
    cancelBubble: false,
    target: {
      getStage: () => ({
        getPointerPosition: () => pointerPos,
      }),
    },
    evt: {
      button: 0,
      clientX: pointerPos?.x ?? 0,
      clientY: pointerPos?.y ?? 0,
    },
  } as unknown as Konva.KonvaEventObject<MouseEvent>;
}

function renderConnectionDrag(overrides: Partial<UseConnectionDragOptions> = {}) {
  const defaultShots = [
    createMockShot('shot-a', 100, 100, 320, 180),
    createMockShot('shot-b', 600, 100, 320, 180),
  ];

  const opts: UseConnectionDragOptions = {
    activeTool: 'connect',
    viewport: { x: 0, y: 0, scale: 1 },
    allShots: defaultShots,
    existingConnections: [],
    onCreateConnection: vi.fn().mockResolvedValue(null),
    onDragStateChange: vi.fn(),
    ...overrides,
  };

  let result!: ReturnType<typeof useConnectionDrag>;
  function Harness() {
    result = useConnectionDrag(opts);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return { hook: result, opts };
}

describe('useConnectionDrag hook', () => {
  it('initializes with null drag state', () => {
    const { hook } = renderConnectionDrag();
    expect(hook.dragStateRef.current).toBeNull();
  });

  it('starts drag on anchor mousedown when activeTool is connect', () => {
    const onDragStateChange = vi.fn();
    const { hook } = renderConnectionDrag({ onDragStateChange });

    const mockEvt = createMockKonvaEvent();
    hook.handleAnchorMouseDown('shot-a', 'right', { x: 420, y: 190 }, mockEvt);

    expect(mockEvt.cancelBubble).toBe(true);
    expect(hook.dragStateRef.current).not.toBeNull();
    expect(hook.dragStateRef.current?.active).toBe(true);
    expect(hook.dragStateRef.current?.fromShotId).toBe('shot-a');
    expect(hook.dragStateRef.current?.fromAnchor).toBe('right');
    expect(hook.dragStateRef.current?.fromPoint).toEqual({ x: 420, y: 190 });
    expect(hook.dragStateRef.current?.previewEnd).toEqual({ x: 420, y: 190 });
    expect(hook.dragStateRef.current?.snapTarget).toBeNull();
    expect(onDragStateChange).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
  });

  it('ignores anchor mousedown when activeTool is select', () => {
    const { hook } = renderConnectionDrag({ activeTool: 'select' });

    const mockEvt = createMockKonvaEvent();
    hook.handleAnchorMouseDown('shot-a', 'right', { x: 420, y: 190 }, mockEvt);

    expect(hook.dragStateRef.current).toBeNull();
  });

  it('tracks pointer move and updates preview coordinates in world space', () => {
    const onDragStateChange = vi.fn();
    const { hook } = renderConnectionDrag({
      viewport: { x: 100, y: 50, scale: 2 },
      onDragStateChange,
    });

    hook.handleAnchorMouseDown('shot-a', 'right', { x: 420, y: 190 }, createMockKonvaEvent());

    // Screen pointer at (300, 250) -> World: x = (300-100)/2 = 100, y = (250-50)/2 = 100
    // Far from shot-b (at 600, 100) -> no snap
    const moveEvt = createMockKonvaEvent({ x: 300, y: 250 });
    hook.handleConnectionMouseMove(moveEvt);

    expect(hook.dragStateRef.current?.previewEnd).toEqual({ x: 100, y: 100 });
    expect(hook.dragStateRef.current?.snapTarget).toBeNull();
    expect(onDragStateChange).toHaveBeenCalled();
  });

  it('magnetically snaps to candidate anchor when within proximity', () => {
    const { hook, opts } = renderConnectionDrag({
      viewport: { x: 0, y: 0, scale: 1 },
    });

    const shotA = opts.allShots[0];
    const shotB = opts.allShots[1];
    const startPoint = getShotAnchorPoint(shotA, 'right');
    const targetPoint = getShotAnchorPoint(shotB, 'left');

    hook.handleAnchorMouseDown('shot-a', 'right', startPoint, createMockKonvaEvent());

    // Pointer 5px to the left of shot-b left anchor -> well within 28px snap radius
    const moveEvt = createMockKonvaEvent({ x: targetPoint.x - 5, y: targetPoint.y });
    hook.handleConnectionMouseMove(moveEvt);

    expect(hook.dragStateRef.current?.snapTarget).toEqual({
      shotId: 'shot-b',
      anchor: 'left',
      point: targetPoint,
    });
    expect(hook.dragStateRef.current?.previewEnd).toEqual(targetPoint);
  });

  it('prevents self-connection snap', () => {
    const { hook, opts } = renderConnectionDrag({
      viewport: { x: 0, y: 0, scale: 1 },
    });

    const shotA = opts.allShots[0];
    const startPoint = getShotAnchorPoint(shotA, 'right');
    const topPoint = getShotAnchorPoint(shotA, 'top');

    hook.handleAnchorMouseDown('shot-a', 'right', startPoint, createMockKonvaEvent());

    // Hovering near shot-a's top anchor
    const moveEvt = createMockKonvaEvent({ x: topPoint.x, y: topPoint.y + 2 });
    hook.handleConnectionMouseMove(moveEvt);

    // Must not snap to itself
    expect(hook.dragStateRef.current?.snapTarget).toBeNull();
  });

  it('prevents duplicate connection snap', () => {
    const existingConn: StoryboardShotConnection = {
      id: 'conn-1',
      project_id: 'p1',
      from_shot_id: 'shot-a',
      to_shot_id: 'shot-b',
      from_anchor: 'right',
      to_anchor: 'left',
      transition_label: '',
      deleted_at: null,
      created_at: '2026-09-18T00:00:00Z',
      updated_at: '2026-09-18T00:00:00Z',
    };

    const { hook, opts } = renderConnectionDrag({
      existingConnections: [existingConn],
    });

    const shotA = opts.allShots[0];
    const shotB = opts.allShots[1];
    const startPoint = getShotAnchorPoint(shotA, 'right');
    const targetPoint = getShotAnchorPoint(shotB, 'left');

    hook.handleAnchorMouseDown('shot-a', 'right', startPoint, createMockKonvaEvent());

    // Hover near shot-b left anchor
    const moveEvt = createMockKonvaEvent({ x: targetPoint.x + 2, y: targetPoint.y });
    hook.handleConnectionMouseMove(moveEvt);

    // Duplicate connection should not be snapped
    expect(hook.dragStateRef.current?.snapTarget).toBeNull();
  });

  it('commits connection on mouseup on valid snap target', async () => {
    const onCreateConnection = vi.fn().mockResolvedValue(null);
    const { hook, opts } = renderConnectionDrag({ onCreateConnection });

    const shotA = opts.allShots[0];
    const shotB = opts.allShots[1];
    const startPoint = getShotAnchorPoint(shotA, 'right');
    const targetPoint = getShotAnchorPoint(shotB, 'left');

    hook.handleAnchorMouseDown('shot-a', 'right', startPoint, createMockKonvaEvent());

    // Snap to shot-b left anchor
    hook.handleConnectionMouseMove(createMockKonvaEvent({ x: targetPoint.x - 2, y: targetPoint.y }));
    expect(hook.dragStateRef.current?.snapTarget).not.toBeNull();

    // Release
    await hook.handleConnectionMouseUp(createMockKonvaEvent({ x: targetPoint.x - 2, y: targetPoint.y }));

    expect(onCreateConnection).toHaveBeenCalledWith({
      fromShotId: 'shot-a',
      toShotId: 'shot-b',
      fromAnchor: 'right',
      toAnchor: 'left',
    });
    expect(hook.dragStateRef.current).toBeNull();
  });

  it('cancels silently on mouseup if no snap target', async () => {
    const onCreateConnection = vi.fn().mockResolvedValue(null);
    const { hook } = renderConnectionDrag({ onCreateConnection });

    hook.handleAnchorMouseDown('shot-a', 'right', { x: 420, y: 190 }, createMockKonvaEvent());

    // Move to empty canvas
    hook.handleConnectionMouseMove(createMockKonvaEvent({ x: 200, y: 500 }));
    expect(hook.dragStateRef.current?.snapTarget).toBeNull();

    // Release
    await hook.handleConnectionMouseUp(createMockKonvaEvent({ x: 200, y: 500 }));

    expect(onCreateConnection).not.toHaveBeenCalled();
    expect(hook.dragStateRef.current).toBeNull();
  });

  it('resets drag state on cancelDrag', () => {
    const onDragStateChange = vi.fn();
    const { hook } = renderConnectionDrag({ onDragStateChange });

    hook.handleAnchorMouseDown('shot-a', 'right', { x: 420, y: 190 }, createMockKonvaEvent());
    expect(hook.dragStateRef.current).not.toBeNull();

    hook.cancelDrag();
    expect(hook.dragStateRef.current).toBeNull();
    expect(onDragStateChange).toHaveBeenLastCalledWith(null);
  });
});
