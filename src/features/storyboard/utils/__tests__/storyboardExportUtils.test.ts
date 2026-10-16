import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateStoryboardExportBounds,
  calculateStageExportConfig,
  sanitizeExportFilename,
  triggerDownload,
} from '../storyboardExportUtils';
import type { StoryboardSceneWithShots, StoryboardStroke, StoryboardShotWithLinks } from '../../types';

function createMockShot(
  id: string,
  x: number,
  y: number,
  width = 280,
  height = 0,
  sceneId = 'scene-1',
  deletedAt: string | null = null
): StoryboardShotWithLinks {
  return {
    id,
    project_id: 'proj-1',
    scene_id: sceneId,
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
    display_order: 0,
    deleted_at: deletedAt,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    references: [],
    direction_notes: [],
  };
}

describe('storyboardExportUtils', () => {
  describe('calculateStoryboardExportBounds', () => {
    it('returns null when no visual elements exist', () => {
      const bounds = calculateStoryboardExportBounds({
        scenes: [],
        shots: [],
        strokes: [],
      });
      expect(bounds).toBeNull();
    });

    it('calculates bounds with scenes and default padding (40px)', () => {
      const scene: StoryboardSceneWithShots = {
        id: 'scene-1',
        project_id: 'proj-1',
        title: 'Scene 1',
        description: '',
        display_order: 0,
        x: 100,
        y: 200,
        width: 600,
        height: 400,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
        shots: [],
      };

      const bounds = calculateStoryboardExportBounds({
        scenes: [scene],
        padding: 40,
      });

      expect(bounds).not.toBeNull();
      // minX = 100 - 40 = 60, minY = 200 - 40 = 160
      // maxX = 700 + 40 = 740, maxY = 600 + 40 = 640
      // width = 740 - 60 = 680, height = 640 - 160 = 480
      expect(bounds).toEqual({
        x: 60,
        y: 160,
        width: 680,
        height: 480,
      });
    });

    it('calculates bounds with shot cards and calculates height from aspect ratio', () => {
      const shot = createMockShot('shot-1', 50, 80, 280, 0);

      const bounds = calculateStoryboardExportBounds({
        scenes: [],
        shots: [shot],
        padding: 10,
      });

      // 16:9 frame height for 280 width is Math.round(280 * 9/16) = 158. Total height = 158 + 82 = 240.
      expect(bounds).toEqual({
        x: 40, // 50 - 10
        y: 70, // 80 - 10
        width: 300, // 280 + 20
        height: 260, // 240 + 20
      });
    });

    it('accounts for freehand stroke points and stroke width', () => {
      const stroke: StoryboardStroke = {
        id: 'stroke-1',
        project_id: 'proj-1',
        points: [100, 100, 200, 150, 300, 120],
        stroke_color: '#F59E0B',
        stroke_width: 8,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
      };

      const bounds = calculateStoryboardExportBounds({
        scenes: [],
        strokes: [stroke],
        padding: 0,
      });

      // points span x: 100..300, y: 100..150
      // halfWidth is 4
      // minX = 100 - 4 = 96, maxX = 300 + 4 = 304, width = 208
      // minY = 100 - 4 = 96, maxY = 150 + 4 = 154, height = 58 -> clamped to min 100
      expect(bounds).toEqual({
        x: 96,
        y: 96,
        width: 208,
        height: 100,
      });
    });

    it('ignores soft-deleted scenes, shots, and strokes', () => {
      const deletedScene: StoryboardSceneWithShots = {
        id: 'scene-del',
        project_id: 'proj-1',
        title: 'Deleted Scene',
        description: '',
        display_order: 0,
        x: 100,
        y: 100,
        width: 500,
        height: 500,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: '2026-01-02',
        shots: [],
      };

      const deletedShot = createMockShot('shot-del', 200, 200, 280, 240, 'scene-1', '2026-01-02');

      const bounds = calculateStoryboardExportBounds({
        scenes: [deletedScene],
        shots: [deletedShot],
        strokes: [],
      });

      expect(bounds).toBeNull();
    });

    it('supports selection mode when specific shot IDs are provided', () => {
      const shot1 = createMockShot('shot-1', 0, 0, 280, 240, 'scene-1');
      const shot2 = createMockShot('shot-2', 1000, 1000, 280, 240, 'scene-2');

      const bounds = calculateStoryboardExportBounds({
        scenes: [],
        shots: [shot1, shot2],
        selectedShotIds: new Set(['shot-1']),
        mode: 'selection',
        padding: 0,
      });

      // Only shot 1 is exported in selection mode
      expect(bounds).toEqual({
        x: 0,
        y: 0,
        width: 280,
        height: 240,
      });
    });
  });

  describe('calculateStageExportConfig', () => {
    it('computes screen coordinates and pixel ratio correctly at 1x zoom', () => {
      const mockStage = {
        scaleX: () => 1,
        x: () => 0,
        y: () => 0,
      };

      const config = calculateStageExportConfig(
        { x: 100, y: 150, width: 800, height: 600 },
        mockStage
      );

      expect(config.x).toBe(100);
      expect(config.y).toBe(150);
      expect(config.width).toBe(800);
      expect(config.height).toBe(600);
      expect(config.pixelRatio).toBe(2);
      expect(config.mimeType).toBe('image/png');
    });

    it('adjusts screen coordinates and calculates pixel ratio when zoomed out', () => {
      const mockStage = {
        scaleX: () => 0.5,
        x: () => 50,
        y: () => 30,
      };

      const config = calculateStageExportConfig(
        { x: 100, y: 150, width: 800, height: 600 },
        mockStage
      );

      // screenX = 100 * 0.5 + 50 = 100
      // screenY = 150 * 0.5 + 30 = 105
      // screenWidth = 800 * 0.5 = 400
      // screenHeight = 600 * 0.5 = 300
      // pixelRatio = 2 / 0.5 = 4
      expect(config.x).toBe(100);
      expect(config.y).toBe(105);
      expect(config.width).toBe(400);
      expect(config.height).toBe(300);
      expect(config.pixelRatio).toBe(4);
    });

    it('caps pixel ratio safely if canvas dimensions would exceed maxDimension', () => {
      const mockStage = {
        scaleX: () => 1,
        x: () => 0,
        y: () => 0,
      };

      // Very large board: 5000px wide
      const config = calculateStageExportConfig(
        { x: 0, y: 0, width: 5000, height: 4000 },
        mockStage,
        { maxDimension: 6000 }
      );

      // At pixelRatio 2, width would be 10000 > 6000. It caps pixelRatio to 6000 / 5000 = 1.2
      expect(config.pixelRatio).toBeCloseTo(1.2, 1);
    });
  });

  describe('sanitizeExportFilename', () => {
    it('creates a clean lowercase filename with project name and suffix', () => {
      const name = sanitizeExportFilename('Cyberpunk 2077 Film Concept');
      expect(name).toBe('cyberpunk-2077-film-concept-storyboard.png');
    });

    it('handles special characters and extra hyphens', () => {
      const name = sanitizeExportFilename('Project #3: Action & Sci-Fi!!');
      expect(name).toBe('project-3-action-sci-fi-storyboard.png');
    });

    it('falls back to creative-storyboard.png when empty', () => {
      const name = sanitizeExportFilename('');
      expect(name).toBe('creative-storyboard.png');
    });
  });

  describe('triggerDownload', () => {
    let originalDocument: any;
    let appendChildSpy: any;
    let removeChildSpy: any;
    let clickSpy: any;

    beforeEach(() => {
      originalDocument = (global as any).document;
      appendChildSpy = vi.fn();
      removeChildSpy = vi.fn();
      clickSpy = vi.fn();

      (global as any).document = {
        body: {
          appendChild: appendChildSpy,
          removeChild: removeChildSpy,
        },
        createElement: vi.fn((tagName: string) => {
          if (tagName === 'a') {
            return {
              download: '',
              href: '',
              click: clickSpy,
            };
          }
          return {};
        }),
      };
    });

    afterEach(() => {
      (global as any).document = originalDocument;
    });

    it('creates an anchor, sets attributes, clicks it, and cleans up from document.body', () => {
      triggerDownload('data:image/png;base64,mock', 'test.png');

      expect((global as any).document.createElement).toHaveBeenCalledWith('a');
      expect(clickSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });
});
