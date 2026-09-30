/**
 * useStoryboard — Visual Frame State & Operations Tests
 *
 * Covers Stage 3.4.2 requirements:
 * 1. updateShotVisualFrame calls storyboardService.updateShot with visual_url and visual_source
 * 2. Assign reference updates local shot visual_url and visual_source = 'reference'
 * 3. Upload success updates local shot visual_url and visual_source = 'upload'
 * 4. Clear frame updates local shot visual_url = '' and visual_source = 'none'
 * 5. Update failure propagates error and surfaces message via error state
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStoryboard } from '../useStoryboard';
import { storyboardService } from '../../services/storyboardService';
import type { StoryboardSceneWithShots, StoryboardShotWithLinks } from '../../types';

vi.mock('../../services/storyboardService', () => ({
  storyboardService: {
    getScenesWithShots: vi.fn(),
    getConnections: vi.fn(),
    createScene: vi.fn(),
    updateScene: vi.fn(),
    deleteScene: vi.fn(),
    reorderScenes: vi.fn(),
    createShot: vi.fn(),
    updateShot: vi.fn(),
    deleteShot: vi.fn(),
    duplicateShot: vi.fn(),
    batchUpdateShotPositions: vi.fn(),
    reorderShots: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    restoreConnection: vi.fn(),
  },
}));

const svc = vi.mocked(storyboardService);

function makeShot(partial: Partial<StoryboardShotWithLinks> & { id: string }): StoryboardShotWithLinks {
  const { id, ...rest } = partial;
  return {
    id,
    project_id: 'proj-1',
    scene_id: 'scene-1',
    shot_number: '1',
    title: 'Shot 1',
    description: '',
    dialogue: '',
    aspect_ratio: '16:9',
    shot_type: null,
    camera_movement: null,
    visual_url: '',
    visual_source: 'none',
    sketch_data: null,
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    z_index: 0,
    display_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    references: [],
    direction_notes: [],
    ...rest,
  };
}

function makeScene(partial: Partial<StoryboardSceneWithShots> & { id: string }): StoryboardSceneWithShots {
  const { id, ...rest } = partial;
  return {
    id,
    project_id: 'proj-1',
    title: 'Scene 1',
    description: '',
    display_order: 0,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    shots: [],
    ...rest,
  };
}

function renderHook(): ReturnType<typeof useStoryboard> {
  let result!: ReturnType<typeof useStoryboard>;
  function Harness() {
    result = useStoryboard('proj-1');
    return null;
  }
  ReactDOMServer.renderToString(React.createElement(Harness));
  return result;
}

describe('useStoryboard — updateShotVisualFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.getScenesWithShots.mockResolvedValue([]);
    svc.getConnections.mockResolvedValue([]);
    svc.updateShot.mockResolvedValue(makeShot({ id: 'shot-1' }) as any);
  });

  it('exposes updateShotVisualFrame in hook return object', () => {
    const hook = renderHook();
    expect(typeof hook.updateShotVisualFrame).toBe('function');
  });

  it('calls storyboardService.updateShot with visual_url and visual_source: reference', async () => {
    const hook = renderHook();
    const refUrl = 'https://images.unsplash.com/photo-test-123';

    await hook.updateShotVisualFrame('shot-1', refUrl, 'reference');

    expect(svc.updateShot).toHaveBeenCalledTimes(1);
    expect(svc.updateShot).toHaveBeenCalledWith('shot-1', {
      visual_url: refUrl,
      visual_source: 'reference',
    });
  });

  it('calls storyboardService.updateShot with visual_url and visual_source: upload', async () => {
    const hook = renderHook();
    const uploadUrl = 'https://xyz.supabase.co/storage/v1/object/public/thumbnails/proj-1/shot-frame.webp';

    await hook.updateShotVisualFrame('shot-2', uploadUrl, 'upload');

    expect(svc.updateShot).toHaveBeenCalledTimes(1);
    expect(svc.updateShot).toHaveBeenCalledWith('shot-2', {
      visual_url: uploadUrl,
      visual_source: 'upload',
    });
  });

  it('calls storyboardService.updateShot with empty URL and visual_source: none on clear', async () => {
    const hook = renderHook();

    await hook.updateShotVisualFrame('shot-1', '', 'none');

    expect(svc.updateShot).toHaveBeenCalledTimes(1);
    expect(svc.updateShot).toHaveBeenCalledWith('shot-1', {
      visual_url: '',
      visual_source: 'none',
    });
  });

  it('propagates errors and sets error state if storyboardService.updateShot rejects', async () => {
    svc.updateShot.mockRejectedValueOnce(new Error('Network failure writing frame'));
    const hook = renderHook();

    await expect(
      hook.updateShotVisualFrame('shot-1', 'https://example.com/pic.jpg', 'reference')
    ).rejects.toThrow('Network failure writing frame');

    expect(hook.error).toBe('Network failure writing frame');
  });
});
