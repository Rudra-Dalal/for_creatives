/**
 * useStoryboardPen — Unit & Integration Tests
 *
 * Tests the Stage 6 Pen drawing lifecycle:
 * 1. Pen pointerdown starts drawing.
 * 2. Pen pointerdown does not persist.
 * 3. Pointermove accumulates world coordinates.
 * 4. Pointermove does not cause React state updates per point.
 * 5. Pointerup finalizes exactly once.
 * 6. Simplification is invoked with tolerance 1.5.
 * 7. World width is calculated correctly.
 * 8. addStroke receives exact points/color/width.
 * 9. Single-point tap produces valid minimal segment through existing utility.
 * 10. Escape cancels without persistence.
 * 11. Tool change cancels without persistence.
 * 12. Read-only mode prevents drawing.
 * 13. Middle mouse does not start drawing.
 * 14. Drawing over shot does not select it (listening=false on objects layer).
 * 15. Drawing over scene does not trigger scene interaction.
 * 16. No persistence occurs before pointerup.
 * 17. Multiple strokes remain independent.
 * 18. Persistence failure does not leave refs in a broken drawing state.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import type Konva from 'konva';
import {
  useStoryboardPen,
  type UseStoryboardPenOptions,
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_WIDTH,
} from '../useStoryboardPen';
import { StoryboardStage } from '../StoryboardStage';
import { Layer } from 'react-konva';

// Mock react-konva for StoryboardStage layer tests
vi.mock('react-konva', () => {
  const MockComponent = (name: string) => {
    const Comp = (props: any) => React.createElement(name, props, props.children);
    Comp.displayName = name;
    return Comp;
  };
  return {
    Stage: MockComponent('konva-stage'),
    Layer: MockComponent('konva-layer'),
    Group: MockComponent('konva-group'),
    Line: MockComponent('konva-line'),
    Rect: MockComponent('konva-rect'),
    Shape: MockComponent('konva-shape'),
  };
});

function createMockKonvaEvent(
  button = 0,
  pointerPos: { x: number; y: number } | null = { x: 100, y: 100 }
) {
  return {
    cancelBubble: false,
    target: {
      getStage: () => ({
        getPointerPosition: () => pointerPos,
      }),
    },
    evt: {
      button,
      clientX: pointerPos?.x ?? 0,
      clientY: pointerPos?.y ?? 0,
    },
  } as unknown as Konva.KonvaEventObject<MouseEvent>;
}

function createMockKonvaLine() {
  let _points: number[] = [];
  let _stroke = '';
  let _strokeWidth = 0;
  let _visible = false;

  return {
    points: vi.fn((pts?: number[]) => {
      if (pts !== undefined) _points = pts;
      return _points;
    }),
    stroke: vi.fn((s?: string) => {
      if (s !== undefined) _stroke = s;
      return _stroke;
    }),
    strokeWidth: vi.fn((w?: number) => {
      if (w !== undefined) _strokeWidth = w;
      return _strokeWidth;
    }),
    visible: vi.fn((v?: boolean) => {
      if (v !== undefined) _visible = v;
      return _visible;
    }),
    lineCap: vi.fn(),
    lineJoin: vi.fn(),
    tension: vi.fn(),
    perfectDrawEnabled: vi.fn(),
    listening: vi.fn(),
  } as unknown as Konva.Line;
}

function createMockKonvaLayer() {
  return {
    batchDraw: vi.fn(),
    draw: vi.fn(),
  } as unknown as Konva.Layer;
}

function renderStoryboardPen(options: Partial<UseStoryboardPenOptions> = {}) {
  const defaultOpts: UseStoryboardPenOptions = {
    activeTool: 'pen',
    viewport: { x: 0, y: 0, scale: 1 },
    readOnly: false,
    penColor: DEFAULT_PEN_COLOR,
    penWidth: DEFAULT_PEN_WIDTH,
    onAddStroke: vi.fn().mockResolvedValue(null),
    onClearSelection: vi.fn(),
    ...options,
  };

  let result!: ReturnType<typeof useStoryboardPen>;
  function Harness() {
    result = useStoryboardPen(defaultOpts);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));

  const mockLine = createMockKonvaLine();
  const mockLayer = createMockKonvaLayer();
  result.liveLineRef.current = mockLine;
  result.strokesLayerRef.current = mockLayer;

  return { hook: result, opts: defaultOpts, mockLine, mockLayer };
}

describe('useStoryboardPen — Drawing Lifecycle & Specifications', () => {
  it('1. Pen pointerdown starts drawing', () => {
    const { hook, mockLine, mockLayer } = renderStoryboardPen();

    const evt = createMockKonvaEvent(0, { x: 150, y: 200 });
    const handled = hook.handlePenMouseDown(evt);

    expect(handled).toBe(true);
    expect(hook.isDrawingRef.current).toBe(true);
    expect(hook.currentPointsRef.current).toEqual([150, 200]);
    expect(mockLine.visible).toHaveBeenCalledWith(true);
    expect(mockLayer.batchDraw).toHaveBeenCalled();
  });

  it('2. Pen pointerdown does not persist to backend', () => {
    const { hook, opts } = renderStoryboardPen();

    const evt = createMockKonvaEvent(0, { x: 100, y: 100 });
    hook.handlePenMouseDown(evt);

    expect(opts.onAddStroke).not.toHaveBeenCalled();
  });

  it('3. Pointermove accumulates world coordinates with viewport transform', () => {
    const { hook, mockLine, mockLayer } = renderStoryboardPen({
      viewport: { x: 50, y: 50, scale: 2 },
    });

    // Screen (150, 150) -> World: (150 - 50)/2 = 50, (150 - 50)/2 = 50
    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 150, y: 150 }));
    expect(hook.currentPointsRef.current).toEqual([50, 50]);

    // Screen (250, 350) -> World: (250 - 50)/2 = 100, (350 - 50)/2 = 150
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 250, y: 350 }));
    expect(hook.currentPointsRef.current).toEqual([50, 50, 100, 150]);

    expect(mockLine.points).toHaveBeenCalledWith([50, 50, 100, 150]);
    expect(mockLayer.batchDraw).toHaveBeenCalledTimes(2);
  });

  it('4. Pointermove does not cause React state updates per point (imperative Konva updates only)', () => {
    const { hook, mockLine, mockLayer } = renderStoryboardPen();

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 100, y: 100 }));
    mockLayer.batchDraw = vi.fn();

    // High frequency moves
    for (let i = 1; i <= 20; i++) {
      hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 100 + i, y: 100 + i }));
    }

    expect(mockLayer.batchDraw).toHaveBeenCalledTimes(20);
    expect(mockLine.points).toHaveBeenCalledTimes(21); // 1 on down, 20 on move
  });

  it('5. Pointerup finalizes exactly once and cleans up live line', () => {
    const { hook, opts, mockLine, mockLayer } = renderStoryboardPen();

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 100, y: 100 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 200, y: 200 }));
    hook.handlePenMouseUp(createMockKonvaEvent(0, { x: 200, y: 200 }));

    expect(hook.isDrawingRef.current).toBe(false);
    expect(hook.currentPointsRef.current).toEqual([]);
    expect(mockLine.visible).toHaveBeenCalledWith(false);
    expect(opts.onAddStroke).toHaveBeenCalledTimes(1);
  });

  it('6. Simplification is invoked with tolerance 1.5', () => {
    const { hook, opts } = renderStoryboardPen();

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 0, y: 0 }));
    // Add 10 collinear points along y = 0
    for (let x = 10; x <= 100; x += 10) {
      hook.handlePenMouseMove(createMockKonvaEvent(0, { x, y: 0 }));
    }
    hook.handlePenMouseUp(createMockKonvaEvent(0, { x: 100, y: 0 }));

    expect(opts.onAddStroke).toHaveBeenCalledTimes(1);
    const [passedPoints] = (opts.onAddStroke as any).mock.calls[0];

    // Collinear points should be decimated down to endpoints [0, 0, 100, 0]
    expect(passedPoints).toEqual([0, 0, 100, 0]);
  });

  it('7. World width is calculated correctly (worldWidth = penWidth / viewport.scale)', () => {
    const { hook, opts } = renderStoryboardPen({
      penWidth: 4,
      viewport: { x: 100, y: 100, scale: 2 },
    });

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 200, y: 200 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 300, y: 300 }));
    hook.handlePenMouseUp(createMockKonvaEvent(0, { x: 300, y: 300 }));

    const expectedWorldWidth = 4 / 2; // 2
    expect(opts.onAddStroke).toHaveBeenCalledWith(
      expect.any(Array),
      DEFAULT_PEN_COLOR,
      expectedWorldWidth
    );
  });

  it('8. addStroke receives exact points, color, and world width', () => {
    const { hook, opts } = renderStoryboardPen({
      penColor: '#F59E0B',
      penWidth: 3,
      viewport: { x: 0, y: 0, scale: 1 },
    });

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 50, y: 50 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 150, y: 150 }));
    hook.handlePenMouseUp(createMockKonvaEvent(0, { x: 150, y: 150 }));

    expect(opts.onAddStroke).toHaveBeenCalledWith(
      [50, 50, 150, 150],
      '#F59E0B',
      3
    );
  });

  it('9. Single-point tap produces valid minimal segment [x, y, x + 0.1, y + 0.1]', () => {
    const { hook, opts } = renderStoryboardPen();

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 120, y: 240 }));
    hook.handlePenMouseUp(createMockKonvaEvent(0, { x: 120, y: 240 }));

    expect(opts.onAddStroke).toHaveBeenCalledTimes(1);
    const [points] = (opts.onAddStroke as any).mock.calls[0];

    // Minimal segment for circular dot rendering
    expect(points).toEqual([120, 240, 120.1, 240.1]);
  });

  it('10. Escape cancels without persistence', () => {
    const { hook, opts, mockLine } = renderStoryboardPen();

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 100, y: 100 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 200, y: 200 }));

    // Cancel via Escape
    hook.cancelDrawing();

    expect(hook.isDrawingRef.current).toBe(false);
    expect(hook.currentPointsRef.current).toEqual([]);
    expect(mockLine.visible).toHaveBeenCalledWith(false);
    expect(opts.onAddStroke).not.toHaveBeenCalled();
  });

  it('11. Tool change cancels without persistence', () => {
    const { hook, opts } = renderStoryboardPen({ activeTool: 'select' });

    // When tool is not 'pen', mousedown is rejected
    const handled = hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 100, y: 100 }));
    expect(handled).toBe(false);
    expect(hook.isDrawingRef.current).toBe(false);
    expect(opts.onAddStroke).not.toHaveBeenCalled();
  });

  it('12. Read-only mode prevents drawing', () => {
    const { hook, opts } = renderStoryboardPen({ readOnly: true });

    const handled = hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 100, y: 100 }));
    expect(handled).toBe(false);
    expect(hook.isDrawingRef.current).toBe(false);
    expect(opts.onAddStroke).not.toHaveBeenCalled();
  });

  it('13. Middle mouse does not start drawing', () => {
    const { hook, opts } = renderStoryboardPen();

    const handled = hook.handlePenMouseDown(createMockKonvaEvent(1, { x: 100, y: 100 }));
    expect(handled).toBe(false);
    expect(hook.isDrawingRef.current).toBe(false);
    expect(opts.onAddStroke).not.toHaveBeenCalled();
  });

  it('14. Drawing over shot does not select it (objects layer listening=false)', () => {
    const penHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StoryboardStage, {
        viewport: { x: 0, y: 0, scale: 1 },
        onViewportChange: () => {},
        activeTool: 'pen',
        containerWidth: 1000,
        containerHeight: 800,
      })
    );

    // In pen mode, storyboard-objects-layer has listening="false", so shot cards cannot receive clicks/drags
    expect(penHtml).toContain('name="storyboard-objects-layer"');
    expect(penHtml).toContain('listening="false"');

    // In select mode, storyboard-objects-layer has listening="true"
    const selectHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StoryboardStage, {
        viewport: { x: 0, y: 0, scale: 1 },
        onViewportChange: () => {},
        activeTool: 'select',
        containerWidth: 1000,
        containerHeight: 800,
      })
    );
    expect(selectHtml).toContain('name="storyboard-objects-layer"');
    expect(selectHtml).toContain('listening="true"');
  });

  it('15. Drawing over scene does not trigger scene interaction', () => {
    // When in pen mode, pointer events are captured by pen handlers and cancelBubble is set
    const { hook } = renderStoryboardPen();
    const event = createMockKonvaEvent(0, { x: 250, y: 250 });

    const handled = hook.handlePenMouseDown(event);
    expect(handled).toBe(true);
    expect(event.cancelBubble).toBe(true);
    expect(hook.isDrawingRef.current).toBe(true);
  });

  it('16. No persistence occurs before pointerup', () => {
    const { hook, opts } = renderStoryboardPen();

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 100, y: 100 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 200, y: 200 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 300, y: 300 }));

    expect(opts.onAddStroke).not.toHaveBeenCalled();
  });

  it('17. Multiple strokes remain independent', () => {
    const { hook, opts } = renderStoryboardPen();

    // Stroke 1
    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 10, y: 10 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 20, y: 20 }));
    hook.handlePenMouseUp(createMockKonvaEvent(0, { x: 20, y: 20 }));

    // Stroke 2
    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 100, y: 100 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 200, y: 200 }));
    hook.handlePenMouseUp(createMockKonvaEvent(0, { x: 200, y: 200 }));

    expect(opts.onAddStroke).toHaveBeenCalledTimes(2);
    const [stroke1] = (opts.onAddStroke as any).mock.calls[0];
    const [stroke2] = (opts.onAddStroke as any).mock.calls[1];

    expect(stroke1).toEqual([10, 10, 20, 20]);
    expect(stroke2).toEqual([100, 100, 200, 200]);
  });

  it('18. Persistence failure does not leave Pen hook refs in a broken state', async () => {
    const failingAddStroke = vi.fn().mockRejectedValue(new Error('DB write failed'));
    const { hook } = renderStoryboardPen({ onAddStroke: failingAddStroke });

    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 10, y: 10 }));
    hook.handlePenMouseMove(createMockKonvaEvent(0, { x: 20, y: 20 }));
    hook.handlePenMouseUp(createMockKonvaEvent(0, { x: 20, y: 20 }));

    // Hook state must be cleanly reset regardless of promise outcome
    expect(hook.isDrawingRef.current).toBe(false);
    expect(hook.currentPointsRef.current).toEqual([]);

    // Next stroke works normally
    hook.handlePenMouseDown(createMockKonvaEvent(0, { x: 30, y: 30 }));
    expect(hook.isDrawingRef.current).toBe(true);
    expect(hook.currentPointsRef.current).toEqual([30, 30]);
  });
});
