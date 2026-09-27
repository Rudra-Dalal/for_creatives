/**
 * StoryboardStrokeNode — Canvas Rendering Tests
 *
 * Tests the Stage 5 Konva stroke rendering specifications:
 * 1. points reach Konva unchanged
 * 2. stroke color is preserved
 * 3. stroke width is preserved
 * 4. round line caps
 * 5. round line joins
 * 6. tension 0
 * 7. perfectDrawEnabled false
 * 8. persisted strokes can render independently
 * 9. malformed/empty strokes do not crash
 * 10. stroke layer is present
 * 11. stroke layer is positioned above shot objects
 * 12. connections remain beneath shot cards
 * 13. world coordinates are not transformed twice
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

// Mock react-konva to run cleanly in Node environment without native canvas dependency
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

import { Line, Layer, Group } from 'react-konva';
import {
  StoryboardStrokeNodeComponent,
  getValidStrokePoints,
} from '../StoryboardStrokeNode';
import { StoryboardStage } from '../StoryboardStage';
import type { StoryboardStroke } from '../../types';

function createMockStroke(overrides: Partial<StoryboardStroke> = {}): StoryboardStroke {
  return {
    id: 'stroke-123',
    project_id: 'proj-1',
    points: [100, 150, 200, 250, 300, 350],
    stroke_color: '#e2e8f0',
    stroke_width: 3,
    created_at: '2026-09-27T00:00:00Z',
    updated_at: '2026-09-27T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('StoryboardStrokeNode — Renderer Specifications', () => {
  it('1. points reach Konva unchanged', () => {
    const rawPoints = [100, 150, 200, 250, 300, 350];
    const stroke = createMockStroke({ points: rawPoints });
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    expect(element.type).toBe(Line);
    expect(element.props.points).toEqual(rawPoints);
    expect(element.props.points).toBe(rawPoints);
  });

  it('2. stroke color is preserved', () => {
    const stroke = createMockStroke({ stroke_color: '#F59E0B' });
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    expect(element.props.stroke).toBe('#F59E0B');
  });

  it('3. stroke width is preserved', () => {
    const stroke = createMockStroke({ stroke_width: 8 });
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    expect(element.props.strokeWidth).toBe(8);
  });

  it('4. round line caps are configured', () => {
    const stroke = createMockStroke();
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    expect(element.props.lineCap).toBe('round');
  });

  it('5. round line joins are configured', () => {
    const stroke = createMockStroke();
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    expect(element.props.lineJoin).toBe('round');
  });

  it('6. tension is strictly 0', () => {
    const stroke = createMockStroke();
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    expect(element.props.tension).toBe(0);
  });

  it('7. perfectDrawEnabled is strictly false for performance', () => {
    const stroke = createMockStroke();
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    expect(element.props.perfectDrawEnabled).toBe(false);
  });

  it('sets listening=false so pointer events pass through to objects below', () => {
    const stroke = createMockStroke();
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    expect(element.props.listening).toBe(false);
  });

  it('8. persisted strokes can render independently', () => {
    const strokeA = createMockStroke({ id: 'stroke-a', points: [10, 20, 30, 40], stroke_color: '#fff' });
    const strokeB = createMockStroke({ id: 'stroke-b', points: [100, 200, 300, 400], stroke_color: '#000' });

    const elA = StoryboardStrokeNodeComponent({ stroke: strokeA }) as React.ReactElement;
    const elB = StoryboardStrokeNodeComponent({ stroke: strokeB }) as React.ReactElement;

    expect(elA).not.toBeNull();
    expect(elB).not.toBeNull();
    expect(elA.props.id).toBe('storyboard-stroke-stroke-a');
    expect(elB.props.id).toBe('storyboard-stroke-stroke-b');
    expect(elA.props.points).toEqual([10, 20, 30, 40]);
    expect(elB.props.points).toEqual([100, 200, 300, 400]);
  });

  it('13. world coordinates are not transformed twice', () => {
    const worldPoints = [100, 100, 200, 200];
    const stroke = createMockStroke({ points: worldPoints });
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;

    expect(element).not.toBeNull();
    // Points must equal exact stored world coordinates without any offsets or scale factor
    expect(element.props.points).toEqual([100, 100, 200, 200]);
    expect(element.props.x).toBeUndefined();
    expect(element.props.y).toBeUndefined();
    expect(element.props.scaleX).toBeUndefined();
    expect(element.props.scaleY).toBeUndefined();
  });
});

describe('StoryboardStrokeNode — Robustness & Validation Handling', () => {
  it('9. malformed/empty strokes do not crash and safely return null', () => {
    // Empty points
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ points: [] }) })).toBeNull();

    // Less than 2 points (fewer than 4 coordinate numbers)
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ points: [10, 20] }) })).toBeNull();

    // Odd coordinate array
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ points: [10, 20, 30] }) })).toBeNull();

    // Points with non-finite values (NaN / Infinity)
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ points: [10, NaN, 30, 40] }) })).toBeNull();
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ points: [10, 20, Infinity, 40] }) })).toBeNull();

    // Non-array points
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ points: null as any }) })).toBeNull();
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ points: {} as any }) })).toBeNull();

    // Soft-deleted stroke
    expect(
      StoryboardStrokeNodeComponent({
        stroke: createMockStroke({ deleted_at: '2026-09-27T12:00:00Z' }),
      })
    ).toBeNull();

    // Invalid stroke_width
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ stroke_width: 0 }) })).toBeNull();
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ stroke_width: -1 }) })).toBeNull();
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ stroke_width: NaN }) })).toBeNull();

    // Invalid stroke_color
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ stroke_color: '' }) })).toBeNull();
    expect(StoryboardStrokeNodeComponent({ stroke: createMockStroke({ stroke_color: '   ' }) })).toBeNull();
  });

  it('safely parses stringified JSON points array', () => {
    const stroke = createMockStroke({ points: '[10, 20, 30, 40]' as any });
    const element = StoryboardStrokeNodeComponent({ stroke }) as React.ReactElement;
    expect(element).not.toBeNull();
    expect(element.props.points).toEqual([10, 20, 30, 40]);
  });

  it('getValidStrokePoints utility returns null for invalid JSON string', () => {
    expect(getValidStrokePoints('{bad: json')).toBeNull();
  });
});

describe('StoryboardStage — Layer Order Architecture', () => {
  it('10, 11, 12. preserves exact visual ordering across layers', () => {
    const mockConnectionsLayer = <Layer name="storyboard-connections-layer" />;
    const mockStrokesLayer = <Layer name="storyboard-strokes-layer" />;
    const mockShotObjects = <Group name="shot-card-group" />;

    const renderedHtml = ReactDOMServer.renderToStaticMarkup(
      <StoryboardStage
        viewport={{ x: 0, y: 0, scale: 1 }}
        onViewportChange={() => {}}
        activeTool="select"
        containerWidth={1200}
        containerHeight={800}
        connectionsLayer={mockConnectionsLayer}
        strokesLayer={mockStrokesLayer}
      >
        {mockShotObjects}
      </StoryboardStage>
    );

    // 10. Stroke layer is present
    expect(renderedHtml).toContain('name="storyboard-strokes-layer"');

    // Indices in the output HTML verify exact rendering sequence:
    const backgroundIdx = renderedHtml.indexOf('name="storyboard-background-layer"');
    const connectionsIdx = renderedHtml.indexOf('name="storyboard-connections-layer"');
    const objectsIdx = renderedHtml.indexOf('name="storyboard-objects-layer"');
    const strokesIdx = renderedHtml.indexOf('name="storyboard-strokes-layer"');

    expect(backgroundIdx).toBeGreaterThan(-1);
    expect(connectionsIdx).toBeGreaterThan(-1);
    expect(objectsIdx).toBeGreaterThan(-1);
    expect(strokesIdx).toBeGreaterThan(-1);

    // Background is bottom layer
    expect(backgroundIdx).toBeLessThan(connectionsIdx);

    // 12. Connections remain beneath shot cards:
    expect(connectionsIdx).toBeLessThan(objectsIdx);

    // 11. Stroke layer is positioned above shot objects:
    expect(strokesIdx).toBeGreaterThan(objectsIdx);
  });
});
