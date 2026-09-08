import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { usePenTool } from '../usePenTool';
import type { UsePenToolOptions } from '../usePenTool';

// ---------------------------------------------------------------------------
// Mock Konva Line & Stage Factories
// ---------------------------------------------------------------------------

function createMockKonvaLine() {
  let _points: number[] = [];
  let _visible = false;
  let _stroke = '';
  let _strokeWidth = 0;
  const mockLayer = {
    batchDraw: vi.fn(),
  };

  return {
    points: vi.fn((val?: number[]) => {
      if (val !== undefined) _points = [...val];
      return _points;
    }),
    visible: vi.fn((val?: boolean) => {
      if (val !== undefined) _visible = val;
      return _visible;
    }),
    stroke: vi.fn((val?: string) => {
      if (val !== undefined) _stroke = val;
      return _stroke;
    }),
    strokeWidth: vi.fn((val?: number) => {
      if (val !== undefined) _strokeWidth = val;
      return _strokeWidth;
    }),
    getLayer: vi.fn(() => mockLayer),
    _mockLayer: mockLayer,
  };
}

function createMockStage(pointer = { x: 100, y: 150 }, scale = 1, stageX = 0, stageY = 0) {
  let currentPointer = { ...pointer };
  return {
    getPointerPosition: vi.fn(() => ({ ...currentPointer })),
    scaleX: vi.fn(() => scale),
    scaleY: vi.fn(() => scale),
    x: vi.fn(() => stageX),
    y: vi.fn(() => stageY),
    setPointer: (x: number, y: number) => {
      currentPointer = { x, y };
    },
  };
}

function renderPenTool(opts: UsePenToolOptions) {
  let result!: ReturnType<typeof usePenTool>;
  function Harness() {
    result = usePenTool(opts);
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePenTool — Authoritative Pen Interaction Controller', () => {
  it('guards against non-pen tools (select / eraser)', () => {
    const mockStage = createMockStage();
    const stageRef = { current: mockStage as any };
    const hook = renderPenTool({
      stageRef,
      activeTool: 'select',
      readOnly: false,
    });

    const evt = { evt: { button: 0 } } as any;
    expect(hook.handleStageMouseDown(evt)).toBe(false);
    expect(hook.isDrawingRef.current).toBe(false);
    expect(hook.handleStageMouseMove(evt)).toBe(false);
    expect(hook.handleStageMouseUp()).toBe(false);
  });

  it('guards against read-only canvas mode', () => {
    const mockStage = createMockStage();
    const stageRef = { current: mockStage as any };
    const hook = renderPenTool({
      stageRef,
      activeTool: 'pen',
      readOnly: true,
    });

    const evt = { evt: { button: 0 } } as any;
    expect(hook.handleStageMouseDown(evt)).toBe(false);
    expect(hook.isDrawingRef.current).toBe(false);
  });

  it('guards against middle mouse button clicks (button === 1)', () => {
    const mockStage = createMockStage();
    const stageRef = { current: mockStage as any };
    const hook = renderPenTool({
      stageRef,
      activeTool: 'pen',
      readOnly: false,
    });

    const evt = { evt: { button: 1 } } as any;
    expect(hook.handleStageMouseDown(evt)).toBe(false);
    expect(hook.isDrawingRef.current).toBe(false);
  });

  it('starts drawing on pointer down and mutates activeLine directly', () => {
    const mockStage = createMockStage({ x: 200, y: 100 }, 1, 0, 0);
    const mockLine = createMockKonvaLine();
    const stageRef = { current: mockStage as any };
    const onClearSelection = vi.fn();

    const hook = renderPenTool({
      stageRef,
      activeTool: 'pen',
      readOnly: false,
      penColor: '#F59E0B',
      penWidth: 6,
      onClearSelection,
    });

    (hook.activeLineRef as any).current = mockLine;

    const evt = { evt: { button: 0 } } as any;
    const handled = hook.handleStageMouseDown(evt);

    expect(handled).toBe(true);
    expect(hook.isDrawingRef.current).toBe(true);
    expect(onClearSelection).toHaveBeenCalledTimes(1);

    // Direct Konva line mutation assertions
    expect(mockLine.points).toHaveBeenCalledWith([200, 100]);
    expect(mockLine.stroke).toHaveBeenCalledWith('#F59E0B');
    expect(mockLine.strokeWidth).toHaveBeenCalledWith(6);
    expect(mockLine.visible).toHaveBeenCalledWith(true);
    expect(mockLine._mockLayer.batchDraw).toHaveBeenCalled();
  });

  it('mutates line points continuously on pointer move without React re-renders', () => {
    const mockStage = createMockStage({ x: 100, y: 100 }, 2, 20, 20);
    const mockLine = createMockKonvaLine();
    const stageRef = { current: mockStage as any };

    const hook = renderPenTool({
      stageRef,
      activeTool: 'pen',
      readOnly: false,
      viewport: { x: 20, y: 20, scale: 2 },
    });

    (hook.activeLineRef as any).current = mockLine;

    const evt = { evt: { button: 0 } } as any;
    hook.handleStageMouseDown(evt);

    // Initial canvas coordinate: (100 - 20) / 2 = 40, (100 - 20) / 2 = 40
    expect(mockLine.points).toHaveBeenLastCalledWith([40, 40]);

    // Move 1: pointer to (140, 160) -> canvas (60, 70)
    mockStage.setPointer(140, 160);
    const move1 = hook.handleStageMouseMove(evt);
    expect(move1).toBe(true);
    expect(mockLine.points).toHaveBeenLastCalledWith([40, 40, 60, 70]);
    expect(mockLine._mockLayer.batchDraw).toHaveBeenCalledTimes(2);

    // Move 2: pointer to (180, 220) -> canvas (80, 100)
    mockStage.setPointer(180, 220);
    const move2 = hook.handleStageMouseMove(evt);
    expect(move2).toBe(true);
    expect(mockLine.points).toHaveBeenLastCalledWith([40, 40, 60, 70, 80, 100]);
    expect(mockLine._mockLayer.batchDraw).toHaveBeenCalledTimes(3);
  });

  it('finalizes, simplifies, normalizes, and commits stroke on pointer up', () => {
    const mockStage = createMockStage({ x: 100, y: 100 }, 1, 0, 0);
    const mockLine = createMockKonvaLine();
    const stageRef = { current: mockStage as any };
    const onAddStroke = vi.fn();

    const hook = renderPenTool({
      stageRef,
      activeTool: 'pen',
      readOnly: false,
      penColor: '#D97706',
      penWidth: 4,
      onAddStroke,
    });

    (hook.activeLineRef as any).current = mockLine;

    const evt = { evt: { button: 0 } } as any;
    hook.handleStageMouseDown(evt);

    mockStage.setPointer(150, 120);
    hook.handleStageMouseMove(evt);

    mockStage.setPointer(200, 180);
    hook.handleStageMouseMove(evt);

    const handledUp = hook.handleStageMouseUp();
    expect(handledUp).toBe(true);
    expect(hook.isDrawingRef.current).toBe(false);

    // Active line should be hidden and cleared on release
    expect(mockLine.visible).toHaveBeenLastCalledWith(false);
    expect(mockLine.points).toHaveBeenLastCalledWith([]);
    expect(mockLine._mockLayer.batchDraw).toHaveBeenCalled();

    // onAddStroke must be called with normalized relative points and bounding box
    expect(onAddStroke).toHaveBeenCalledTimes(1);
    const [relativePoints, color, width, bbox] = onAddStroke.mock.calls[0];

    expect(color).toBe('#D97706');
    expect(width).toBe(4);
    expect(bbox.x).toBe(100);
    expect(bbox.y).toBe(100);
    expect(bbox.width).toBe(100); // 200 - 100
    expect(bbox.height).toBe(80);  // 180 - 100
    expect(relativePoints.length).toBeGreaterThanOrEqual(4);
    // Origin of relativePoints should start at 0, 0
    expect(relativePoints[0]).toBe(0);
    expect(relativePoints[1]).toBe(0);
  });

  it('does not commit strokes with fewer than 2 points', () => {
    const mockStage = createMockStage({ x: 100, y: 100 });
    const stageRef = { current: mockStage as any };
    const onAddStroke = vi.fn();

    const hook = renderPenTool({
      stageRef,
      activeTool: 'pen',
      readOnly: false,
      onAddStroke,
    });

    // Mouse up without mouse down
    expect(hook.handleStageMouseUp()).toBe(false);
    expect(onAddStroke).not.toHaveBeenCalled();
  });

  it('converts penWidth from screen-space to canvas-space at zoom scale 2.0', () => {
    // At scale 2.0, penWidth 8px screen → 4px canvas
    const mockStage = createMockStage({ x: 100, y: 100 }, 2, 0, 0);
    const mockLine = createMockKonvaLine();
    const stageRef = { current: mockStage as any };
    const onAddStroke = vi.fn();

    const hook = renderPenTool({
      stageRef,
      activeTool: 'pen',
      readOnly: false,
      penColor: '#D97706',
      penWidth: 8,
      viewport: { x: 0, y: 0, scale: 2 },
      onAddStroke,
    });

    (hook.activeLineRef as any).current = mockLine;

    const evt = { evt: { button: 0 } } as any;
    hook.handleStageMouseDown(evt);

    // On stroke start, strokeWidth should be converted: 8 / 2 = 4
    expect(mockLine.strokeWidth).toHaveBeenCalledWith(4);

    mockStage.setPointer(200, 200);
    hook.handleStageMouseMove(evt);
    hook.handleStageMouseUp();

    // Committed stroke width should also be 4 (canvas-space)
    expect(onAddStroke).toHaveBeenCalledTimes(1);
    const [, , committedWidth] = onAddStroke.mock.calls[0];
    expect(committedWidth).toBe(4);
  });

  it('converts penWidth from screen-space to canvas-space at zoom scale 0.5', () => {
    // At scale 0.5, penWidth 4px screen → 8px canvas
    const mockStage = createMockStage({ x: 100, y: 100 }, 0.5, 0, 0);
    const mockLine = createMockKonvaLine();
    const stageRef = { current: mockStage as any };
    const onAddStroke = vi.fn();

    const hook = renderPenTool({
      stageRef,
      activeTool: 'pen',
      readOnly: false,
      penColor: '#D97706',
      penWidth: 4,
      viewport: { x: 0, y: 0, scale: 0.5 },
      onAddStroke,
    });

    (hook.activeLineRef as any).current = mockLine;

    const evt = { evt: { button: 0 } } as any;
    hook.handleStageMouseDown(evt);

    // On stroke start, strokeWidth should be converted: 4 / 0.5 = 8
    expect(mockLine.strokeWidth).toHaveBeenCalledWith(8);

    mockStage.setPointer(200, 200);
    hook.handleStageMouseMove(evt);
    hook.handleStageMouseUp();

    // Committed stroke width should also be 8 (canvas-space)
    expect(onAddStroke).toHaveBeenCalledTimes(1);
    const [, , committedWidth] = onAddStroke.mock.calls[0];
    expect(committedWidth).toBe(8);
  });
});
