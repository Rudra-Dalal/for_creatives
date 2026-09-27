import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storyboardService } from '../storyboardService';
import { createClient } from '@/lib/supabase/client';
import type { StoryboardStroke } from '../../types';

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

function makeMockStroke(overrides: Partial<StoryboardStroke> = {}): StoryboardStroke {
  return {
    id: 'stroke-uuid-1',
    project_id: 'proj-123',
    points: [10, 20, 30, 40],
    stroke_color: '#D97706',
    stroke_width: 4,
    created_at: '2026-09-27T10:00:00.000Z',
    updated_at: '2026-09-27T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('storyboardService — Stroke Operations', () => {
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
  };
  let queryChain: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queryChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn(),
      single: vi.fn(),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(queryChain),
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);
  });

  // =========================================================================
  // 1. getStrokes
  // =========================================================================
  describe('getStrokes', () => {
    it('queries active strokes with correct project_id and deterministic ordering', async () => {
      const mockRows = [
        makeMockStroke({ id: 'stroke-1', created_at: '2026-09-27T10:00:00.000Z' }),
        makeMockStroke({ id: 'stroke-2', created_at: '2026-09-27T10:05:00.000Z' }),
      ];

      queryChain.order.mockResolvedValueOnce({ data: mockRows, error: null });

      const result = await storyboardService.getStrokes('proj-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('storyboard_strokes');
      expect(queryChain.select).toHaveBeenCalledWith('*');
      expect(queryChain.eq).toHaveBeenCalledWith('project_id', 'proj-123');
      expect(queryChain.is).toHaveBeenCalledWith('deleted_at', null);
      expect(queryChain.order).toHaveBeenCalledWith('created_at', { ascending: true });
      expect(result).toEqual(mockRows);
    });

    it('returns empty array when no strokes exist for project', async () => {
      queryChain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await storyboardService.getStrokes('proj-empty');
      expect(result).toEqual([]);
    });

    it('rejects empty or whitespace-only project ID', async () => {
      await expect(storyboardService.getStrokes('')).rejects.toThrow(
        'getStrokes: projectId is required'
      );
      await expect(storyboardService.getStrokes('   ')).rejects.toThrow(
        'getStrokes: projectId is required'
      );
    });

    it('propagates Supabase errors with an identifying prefix', async () => {
      queryChain.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection terminated' },
      });

      await expect(storyboardService.getStrokes('proj-123')).rejects.toThrow(
        'getStrokes: Database connection terminated'
      );
    });
  });

  // =========================================================================
  // 2. createStroke
  // =========================================================================
  describe('createStroke', () => {
    it('inserts mapped fields and returns created row without transforming points', async () => {
      const expectedPoints = [10.5, 20.2, 55.0, 80.8];
      const insertedRow = makeMockStroke({
        id: 'new-stroke-uuid',
        project_id: 'proj-123',
        points: expectedPoints,
        stroke_color: '#EF4444',
        stroke_width: 6,
      });

      queryChain.single.mockResolvedValueOnce({ data: insertedRow, error: null });

      const result = await storyboardService.createStroke({
        projectId: 'proj-123',
        points: expectedPoints,
        strokeColor: '#EF4444',
        strokeWidth: 6,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('storyboard_strokes');
      expect(queryChain.insert).toHaveBeenCalledWith({
        project_id: 'proj-123',
        points: expectedPoints,
        stroke_color: '#EF4444',
        stroke_width: 6,
      });
      expect(queryChain.select).toHaveBeenCalled();
      expect(queryChain.single).toHaveBeenCalled();
      expect(result).toEqual(insertedRow);
    });

    it('propagates Supabase errors with an identifying prefix', async () => {
      queryChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS check failed' },
      });

      await expect(
        storyboardService.createStroke({
          projectId: 'proj-123',
          points: [0, 0, 10, 10],
          strokeColor: '#D97706',
          strokeWidth: 2,
        })
      ).rejects.toThrow('createStroke: RLS check failed');
    });

    describe('input validation guards', () => {
      it('rejects empty or missing projectId', async () => {
        await expect(
          storyboardService.createStroke({
            projectId: '',
            points: [0, 0, 10, 10],
            strokeColor: '#D97706',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: projectId is required');
      });

      it('rejects empty or non-array points', async () => {
        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [] as number[],
            strokeColor: '#D97706',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: points must be a valid flat coordinate array');

        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: null as unknown as number[],
            strokeColor: '#D97706',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: points must be a valid flat coordinate array');
      });

      it('rejects arrays with fewer than 4 coordinates (fewer than 2 points)', async () => {
        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [10, 20],
            strokeColor: '#D97706',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: points must be a valid flat coordinate array');
      });

      it('rejects arrays with an odd number of coordinates', async () => {
        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [0, 0, 10, 10, 20],
            strokeColor: '#D97706',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: points must be a valid flat coordinate array');
      });

      it('rejects non-finite or NaN coordinates in points array', async () => {
        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [0, 0, NaN, 10],
            strokeColor: '#D97706',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: points must be a valid flat coordinate array');

        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [0, 0, Infinity, 10],
            strokeColor: '#D97706',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: points must be a valid flat coordinate array');
      });

      it('rejects zero or negative stroke width', async () => {
        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [0, 0, 10, 10],
            strokeColor: '#D97706',
            strokeWidth: 0,
          })
        ).rejects.toThrow('createStroke: strokeWidth must be a positive finite number');

        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [0, 0, 10, 10],
            strokeColor: '#D97706',
            strokeWidth: -2,
          })
        ).rejects.toThrow('createStroke: strokeWidth must be a positive finite number');
      });

      it('rejects empty or whitespace stroke color', async () => {
        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [0, 0, 10, 10],
            strokeColor: '',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: strokeColor must be a non-empty string');

        await expect(
          storyboardService.createStroke({
            projectId: 'proj-1',
            points: [0, 0, 10, 10],
            strokeColor: '   ',
            strokeWidth: 2,
          })
        ).rejects.toThrow('createStroke: strokeColor must be a non-empty string');
      });
    });
  });

  // =========================================================================
  // 3. softDeleteStroke
  // =========================================================================
  describe('softDeleteStroke', () => {
    it('sets deleted_at timestamp on requested row and returns updated row', async () => {
      const deletedRow = makeMockStroke({
        id: 'stroke-to-delete',
        deleted_at: '2026-09-27T11:00:00.000Z',
      });

      queryChain.single.mockResolvedValueOnce({ data: deletedRow, error: null });

      const result = await storyboardService.softDeleteStroke('stroke-to-delete');

      expect(mockSupabase.from).toHaveBeenCalledWith('storyboard_strokes');
      expect(queryChain.update).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
      });
      expect(queryChain.eq).toHaveBeenCalledWith('id', 'stroke-to-delete');
      expect(queryChain.select).toHaveBeenCalled();
      expect(queryChain.single).toHaveBeenCalled();
      expect(result).toEqual(deletedRow);
    });

    it('rejects empty or whitespace-only stroke id', async () => {
      await expect(storyboardService.softDeleteStroke('')).rejects.toThrow(
        'softDeleteStroke: stroke id is required'
      );
      await expect(storyboardService.softDeleteStroke('   ')).rejects.toThrow(
        'softDeleteStroke: stroke id is required'
      );
    });

    it('propagates Supabase errors with an identifying prefix', async () => {
      queryChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Row not found or permission denied' },
      });

      await expect(storyboardService.softDeleteStroke('stroke-123')).rejects.toThrow(
        'softDeleteStroke: Row not found or permission denied'
      );
    });
  });
});
