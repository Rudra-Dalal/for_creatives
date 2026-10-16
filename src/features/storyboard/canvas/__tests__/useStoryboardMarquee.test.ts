import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Konva from 'konva';
import { useStoryboardMarquee, type UseStoryboardMarqueeOptions } from '../useStoryboardMarquee';
import type { StoryboardShotWithLinks, StoryboardViewport } from '../../types';

describe('useStoryboardMarquee — Rubber-Band Multi-Selection', () => {
  const mockViewport: StoryboardViewport = { x: 0, y: 0, scale: 1 };

  const mockShot1: StoryboardShotWithLinks = {
    id: 'shot-1',
    scene_id: 'scene-1',
    project_id: 'proj-1',
    shot_number: '1',
    title: 'Shot 1',
    description: '',
    dialogue: '',
    aspect_ratio: '16:9',
    shot_type: 'wide',
    camera_movement: 'static',
    visual_url: '',
    visual_source: 'none',
    sketch_data: null,
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    z_index: 1,
    display_order: 0,
    created_at: '2026-10-16T00:00:00Z',
    updated_at: '2026-10-16T00:00:00Z',
    deleted_at: null,
    references: [],
    direction_notes: [],
  };

  const mockShot2: StoryboardShotWithLinks = {
    ...mockShot1,
    id: 'shot-2',
    shot_number: '2',
    x: 400,
    y: 100,
  };

  const mockShot3: StoryboardShotWithLinks = {
    ...mockShot1,
    id: 'shot-3',
    shot_number: '3',
    x: 700,
    y: 100,
  };

  const allShots = [mockShot1, mockShot2, mockShot3];

  let onSelectShots: ReturnType<typeof vi.fn>;
  let onClearSceneSelection: ReturnType<typeof vi.fn>;
  let mockStage: {
    getStage: () => unknown;
    getPointerPosition: () => { x: number; y: number } | null;
    name: () => string;
  };
  let pointerPos: { x: number; y: number } | null;

  beforeEach(() => {
    onSelectShots = vi.fn();
    onClearSceneSelection = vi.fn();
    pointerPos = { x: 0, y: 0 };
    mockStage = {
      getStage: () => mockStage,
      getPointerPosition: () => pointerPos,
      name: () => 'storyboard-background-layer',
    };
  });

  function renderStoryboardMarquee(options: Partial<UseStoryboardMarqueeOptions> = {}) {
    const opts: UseStoryboardMarqueeOptions = {
      allShots,
      viewport: mockViewport,
      activeTool: 'select',
      selectedShotIds: new Set(),
      onSelectShots,
      onClearSceneSelection,
      ...options,
    };

    let result!: ReturnType<typeof useStoryboardMarquee>;
    function Harness() {
      result = useStoryboardMarquee(opts);
      return null;
    }
    ReactDOMServer.renderToString(React.createElement(Harness));

    return { hook: result, opts };
  }

  function createKonvaEvent(
    target: unknown,
    options: {
      button?: number;
      shiftKey?: boolean;
      metaKey?: boolean;
      ctrlKey?: boolean;
    } = {}
  ): Konva.KonvaEventObject<MouseEvent> {
    return {
      target: target as Konva.Node,
      evt: {
        button: options.button ?? 0,
        shiftKey: options.shiftKey ?? false,
        metaKey: options.metaKey ?? false,
        ctrlKey: options.ctrlKey ?? false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as MouseEvent,
    } as unknown as Konva.KonvaEventObject<MouseEvent>;
  }

  it('initializes with inactive marquee and null bounds', () => {
    const { hook } = renderStoryboardMarquee();

    expect(hook.marqueeBounds).toBeNull();
    expect(hook.isMarqueeActive).toBe(false);
  });

  it('ignores non-left mouse clicks (e.g. right-click or middle-click pan)', () => {
    const { hook } = renderStoryboardMarquee();

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage, { button: 1 }));

    pointerPos = { x: 300, y: 300 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage));

    expect(hook.marqueeBounds).toBeNull();
    expect(hook.isMarqueeActive).toBe(false);
  });

  it('ignores drag when activeTool is not "select" (e.g. pen, eraser, connect)', () => {
    const { hook } = renderStoryboardMarquee({ activeTool: 'pen' });

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage));

    pointerPos = { x: 300, y: 300 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage));

    expect(hook.marqueeBounds).toBeNull();
    expect(hook.isMarqueeActive).toBe(false);
  });

  it('does not activate marquee if movement does not exceed CLICK_VS_DRAG_THRESHOLD_PX (4px)', () => {
    const { hook } = renderStoryboardMarquee();

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage));

    // Move only 2px
    pointerPos = { x: 52, y: 51 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage));

    expect(hook.marqueeBounds).toBeNull();
    expect(hook.isMarqueeActive).toBe(false);
  });

  it('activates marquee and computes live AABB intersection when dragged past 4px', () => {
    const { hook } = renderStoryboardMarquee();

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage));

    // Drag over shot-1 (x: 100..300, y: 100..250)
    pointerPos = { x: 350, y: 300 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage));

    expect(hook.marqueeBounds).toEqual({
      x: 50,
      y: 50,
      width: 300,
      height: 250,
    });
    expect(hook.isMarqueeActive).toBe(true);
    expect(onSelectShots).toHaveBeenCalledWith(new Set(['shot-1']));
  });

  it('handles negative/backwards drag directions cleanly', () => {
    const { hook } = renderStoryboardMarquee();

    // Start at bottom right and drag up-left
    pointerPos = { x: 500, y: 300 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage));

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage));

    // Encompasses shot-1 and shot-2
    expect(hook.marqueeBounds).toEqual({
      x: 50,
      y: 50,
      width: 450,
      height: 250,
    });
    expect(onSelectShots).toHaveBeenCalledWith(new Set(['shot-1', 'shot-2']));
  });

  it('supports Shift-drag to add to existing selection', () => {
    const { hook } = renderStoryboardMarquee({
      selectedShotIds: new Set(['shot-3']),
    });

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage, { shiftKey: true }));

    // Drag over shot-1
    pointerPos = { x: 350, y: 300 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage, { shiftKey: true }));

    // Should include previous shot-3 + newly hit shot-1
    expect(onSelectShots).toHaveBeenCalledWith(new Set(['shot-3', 'shot-1']));
    // onClearSceneSelection should not be called on Shift drag
    expect(onClearSceneSelection).not.toHaveBeenCalled();
  });

  it('clears marquee bounds and commits selection on mouseup', () => {
    const { hook } = renderStoryboardMarquee();

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage));

    pointerPos = { x: 550, y: 300 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage));

    expect(hook.isMarqueeActive).toBe(true);

    hook.handleStageMouseUp(createKonvaEvent(mockStage));

    // Marquee box should be cleared
    expect(hook.marqueeBounds).toBeNull();
    expect(hook.isMarqueeActive).toBe(false);
  });

  it('cancelMarquee immediately resets bounds and active state', () => {
    const { hook } = renderStoryboardMarquee();

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage));

    pointerPos = { x: 350, y: 300 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage));

    expect(hook.isMarqueeActive).toBe(true);

    hook.cancelMarquee();

    expect(hook.marqueeBounds).toBeNull();
    expect(hook.isMarqueeActive).toBe(false);
  });

  it('does nothing in readOnly mode', () => {
    const { hook } = renderStoryboardMarquee({ readOnly: true });

    pointerPos = { x: 50, y: 50 };
    hook.handleStageMouseDown(createKonvaEvent(mockStage));

    pointerPos = { x: 350, y: 300 };
    hook.handleStageMouseMove(createKonvaEvent(mockStage));

    expect(hook.marqueeBounds).toBeNull();
    expect(onSelectShots).not.toHaveBeenCalled();
  });
});
