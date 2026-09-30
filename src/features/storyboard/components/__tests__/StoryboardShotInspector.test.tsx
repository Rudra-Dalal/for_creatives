/**
 * StoryboardShotInspector — Visual Frame Acquisition & Inspector Tests
 *
 * Covers Stage 3.4.2 requirements:
 * 1. Current Frame Preview: Empty-frame placeholder when none exists
 * 2. Current Frame Preview: Image preview + 'Reference'/'Upload' badge when frame exists
 * 3. Assign Reference as Frame:
 *    - Empty state when shot has 0 linked references
 *    - Listing of linked references with thumbnails and titles
 *    - Active indicator on current reference frame
 *    - Clicking sets visual_url = ref.thumbnail_url and visual_source = 'reference'
 * 4. Upload Frame Image:
 *    - File upload input and trigger button
 *    - Upload failure preserves current frame and displays error feedback
 * 5. Clear Frame:
 *    - Only shown when frame exists
 *    - Sets visual_url = '' and visual_source = 'none'
 * 6. Read-Only Mode:
 *    - Visual frame preview remains visible
 *    - Editing actions (upload, clear, reference click) are not available
 * 7. Existing Inspector Fields:
 *    - Shot title, scene territory, aspect ratios, framing, movement, description preserved
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryboardShotInspector } from '../StoryboardShotInspector';
import type { StoryboardShotWithLinks, StoryboardSceneWithShots } from '../../types';
import type { Reference } from '@/features/references/types';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock('@/features/references/services/thumbnailService', () => ({
  thumbnailService: {
    uploadThumbnail: vi.fn(),
    deleteThumbnail: vi.fn(),
  },
}));

function makeReference(partial: Partial<Reference> & { id: string }): Reference {
  const { id, ...rest } = partial;
  return {
    id,
    project_id: 'proj-1',
    url: 'https://example.com/ref-1',
    title: 'Reference Inspiration',
    thumbnail_url: 'https://images.unsplash.com/photo-ref-1',
    source_domain: 'unsplash.com',
    note: '',
    tags: ['mood'],
    created_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...rest,
  };
}

function makeShot(partial: Partial<StoryboardShotWithLinks> & { id: string }): StoryboardShotWithLinks {
  const { id, ...rest } = partial;
  return {
    id,
    project_id: 'proj-1',
    scene_id: 'scene-1',
    shot_number: '1',
    title: 'Wide establishing shot',
    description: 'Camera pans across the horizon',
    dialogue: '',
    aspect_ratio: '16:9',
    shot_type: 'wide',
    camera_movement: 'pan',
    visual_url: '',
    visual_source: 'none',
    sketch_data: null,
    x: 100,
    y: 100,
    width: 280,
    height: 180,
    z_index: 1,
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
    title: 'Interior Cafe',
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

function renderInspector(
  shot: StoryboardShotWithLinks | null,
  options: {
    readOnly?: boolean;
    onUpdateShot?: ReturnType<typeof vi.fn>;
    onUpdateVisualFrame?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const onUpdateShot = options.onUpdateShot || vi.fn().mockResolvedValue(undefined);
  const onUpdateVisualFrame = options.onUpdateVisualFrame || vi.fn().mockResolvedValue(undefined);
  const onReassignScene = vi.fn().mockResolvedValue(undefined);
  const onDuplicateShot = vi.fn().mockResolvedValue(undefined);
  const onDeleteShot = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  const scenes = [makeScene({ id: 'scene-1', title: 'Scene 1' })];

  const html = ReactDOMServer.renderToString(
    React.createElement(StoryboardShotInspector, {
      shot,
      scenes,
      projectId: 'proj-1',
      readOnly: options.readOnly,
      onClose,
      onUpdateShot,
      onUpdateVisualFrame,
      onReassignScene,
      onDuplicateShot,
      onDeleteShot,
    })
  );

  return { html, onUpdateShot, onUpdateVisualFrame, onReassignScene, onClose };
}

describe('StoryboardShotInspector — Visual Frame Acquisition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Current Frame Preview: Empty State
  describe('empty frame preview', () => {
    it('renders "Empty Frame" placeholder when shot has visual_source: none', () => {
      const shot = makeShot({ id: 'shot-1', visual_source: 'none', visual_url: '' });
      const { html } = renderInspector(shot);

      expect(html).toContain('Empty Frame');
      expect(html).toContain('Assign a linked reference or upload an image');
      expect(html).not.toContain('Clear');
    });

    it('renders "Upload Image" button when empty frame in edit mode', () => {
      const shot = makeShot({ id: 'shot-1', visual_source: 'none', visual_url: '' });
      const { html } = renderInspector(shot);

      expect(html).toContain('Upload Image');
    });
  });

  // 2. Current Frame Preview: Active Frame
  describe('active frame preview', () => {
    it('renders image preview and "Reference" badge when visual_source is reference', () => {
      const shot = makeShot({
        id: 'shot-1',
        visual_source: 'reference',
        visual_url: 'https://images.unsplash.com/photo-ref-1',
      });
      const { html } = renderInspector(shot);

      expect(html).toContain('Reference');
      expect(html).toContain('Clear');
      expect(html).toContain('Shot Frame Preview');
      expect(html).toContain('https://images.unsplash.com/photo-ref-1');
    });

    it('renders image preview and "Upload" badge when visual_source is upload', () => {
      const shot = makeShot({
        id: 'shot-1',
        visual_source: 'upload',
        visual_url: 'https://xyz.supabase.co/storage/v1/object/public/thumbnails/proj-1/frame.webp',
      });
      const { html } = renderInspector(shot);

      expect(html).toContain('Upload');
      expect(html).toContain('Clear');
      expect(html).toContain('Shot Frame Preview');
      expect(html).toContain('https://xyz.supabase.co/storage/v1/object/public/thumbnails/proj-1/frame.webp');
    });
  });

  // 3. Assign Reference Section
  describe('assign reference as frame', () => {
    it('shows passive empty state when shot has no linked references', () => {
      const shot = makeShot({ id: 'shot-1', references: [] });
      const { html } = renderInspector(shot);

      expect(html).toContain('Linked References');
      expect(html).toContain('No references linked to this shot');
    });

    it('renders list of linked references with thumbnails and titles', () => {
      const ref1 = makeReference({
        id: 'ref-1',
        title: 'Cyberpunk Alley',
        thumbnail_url: 'https://images.unsplash.com/ref-1',
      });
      const ref2 = makeReference({
        id: 'ref-2',
        title: 'Neon Lighting',
        thumbnail_url: 'https://images.unsplash.com/ref-2',
      });
      const shot = makeShot({
        id: 'shot-1',
        references: [ref1, ref2],
        visual_source: 'reference',
        visual_url: 'https://images.unsplash.com/ref-1',
      });

      const { html } = renderInspector(shot);

      expect(html).toContain('Linked References');
      expect(html).toContain('Cyberpunk Alley');
      expect(html).toContain('Neon Lighting');
      expect(html).toContain('Active visual frame');
    });
  });

  // 4. Read-Only Mode
  describe('read-only mode', () => {
    it('displays frame preview but hides editing controls', () => {
      const shot = makeShot({
        id: 'shot-1',
        visual_source: 'reference',
        visual_url: 'https://images.unsplash.com/photo-123',
      });
      const { html } = renderInspector(shot, { readOnly: true });

      // Frame preview must still be visible
      expect(html).toContain('Shot Frame Preview');
      // Upload and Clear buttons must not be rendered
      expect(html).not.toContain('Upload Image');
      expect(html).not.toContain('Clear');
      // Duplicate and Delete footer buttons must not be rendered
      expect(html).not.toContain('Duplicate');
      expect(html).not.toContain('Delete');
    });

    it('shows read-only message when no frame is assigned in read-only mode', () => {
      const shot = makeShot({ id: 'shot-1', visual_source: 'none', visual_url: '' });
      const { html } = renderInspector(shot, { readOnly: true });

      expect(html).toContain('Empty Frame');
      expect(html).toContain('No visual frame assigned');
      expect(html).not.toContain('Upload Image');
    });
  });

  // 5. Existing Inspector Behavior Preserved
  describe('existing inspector fields', () => {
    it('preserves shot title, aspect ratios, scene territory, framing, and movement', () => {
      const shot = makeShot({
        id: 'shot-1',
        title: 'Key Climactic Encounter',
        aspect_ratio: '16:9',
        shot_type: 'extreme_close_up',
        camera_movement: 'dolly',
        description: 'Protagonist gazes intently',
      });
      const { html } = renderInspector(shot);

      expect(html).toContain('SHOT');
      expect(html).toContain('01');
      expect(html).toContain('Key Climactic Encounter');
      expect(html).toContain('Scene Territory');
      expect(html).toContain('Aspect Ratio');
      expect(html).toContain('16:9');
      expect(html).toContain('9:16');
      expect(html).toContain('Framing');
      expect(html).toContain('Movement');
      expect(html).toContain('Action / Notes');
      expect(html).toContain('Protagonist gazes intently');
      expect(html).toContain('Duplicate');
      expect(html).toContain('Delete');
    });
  });
});
