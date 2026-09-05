import { createClient } from '@/lib/supabase/client';
import type { Database, Json } from '@/types/database.types';
import type { MoodboardItem, MoodboardItemInsert, MoodboardItemUpdate } from '../types';
import type { Reference } from '@/features/references/types';

function mapItemRecord(item: any): MoodboardItem {
  const ref = item.references as unknown as Reference | null;
  const rawContent = (item.content as unknown as Record<string, unknown>) || {};
  const isStroke =
    item.type === 'stroke' ||
    (item.type === 'idea' && rawContent.strokeType === 'stroke') ||
    Array.isArray(rawContent.points);

  return {
    id: item.id,
    project_id: item.project_id,
    reference_id: item.reference_id,
    type: isStroke ? 'stroke' : (item.type as MoodboardItem['type']),
    content: rawContent as unknown as MoodboardItem['content'],
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    z_index: item.z_index,
    created_at: item.created_at,
    updated_at: item.updated_at,
    deleted_at: item.deleted_at,
    reference: ref && typeof ref === 'object' && 'id' in ref ? ref : null,
  };
}

export const moodboardService = {
  /**
   * Fetch all active moodboard canvas items for a project,
   * joined with any associated reference metadata.
   */
  async getItems(projectId: string): Promise<MoodboardItem[]> {
    const supabase = createClient();

    const { data: items, error } = await supabase
      .from('moodboard_items')
      .select(`
        *,
        references (*)
      `)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('z_index', { ascending: true });

    if (error) throw error;
    if (!items) return [];

    return items.map(mapItemRecord);
  },

  /**
   * Fetch all soft-deleted moodboard canvas items in trash.
   */
  async getTrashItems(projectId: string): Promise<MoodboardItem[]> {
    const supabase = createClient();

    const { data: items, error } = await supabase
      .from('moodboard_items')
      .select(`
        *,
        references (*)
      `)
      .eq('project_id', projectId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    if (!items) return [];

    return items.map(mapItemRecord);
  },

  /**
   * Create a new moodboard canvas item.
   */
  async createItem(input: {
    projectId: string;
    referenceId?: string | null;
    type: MoodboardItem['type'];
    content?: Json;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    zIndex?: number;
  }): Promise<MoodboardItem> {
    const supabase = createClient();

    let defaultWidth = 300;
    let defaultHeight = 220;
    if (input.type === 'text') {
      defaultWidth = 240;
      defaultHeight = 160;
    } else if (input.type === 'color') {
      defaultWidth = 180;
      defaultHeight = 180;
    } else if (input.type === 'idea') {
      defaultWidth = 280;
      defaultHeight = 180;
    } else if (input.type === 'image') {
      defaultWidth = 320;
      defaultHeight = 240;
    }

    let payload: MoodboardItemInsert = {
      project_id: input.projectId,
      reference_id: input.referenceId || null,
      type: input.type,
      content: input.content || {},
      x: input.x ?? 0,
      y: input.y ?? 0,
      width: input.width ?? defaultWidth,
      height: input.height ?? defaultHeight,
      z_index: input.zIndex ?? 1,
    };

    let { data: item, error } = await supabase
      .from('moodboard_items')
      .insert(payload)
      .select(`
        *,
        references (*)
      `)
      .single();

    // If Postgres constraint rejects 'stroke' on an unmigrated database,
    // gracefully fall back to storing with strokeType in schema-free jsonb content
    if (error && input.type === 'stroke' && error.code === '23514') {
      const fallbackContent = {
        ...(typeof input.content === 'object' && input.content !== null ? input.content : {}),
        strokeType: 'stroke',
      };
      payload = {
        ...payload,
        type: 'idea',
        content: fallbackContent as unknown as Json,
      };
      const fallbackRes = await supabase
        .from('moodboard_items')
        .insert(payload)
        .select(`
          *,
          references (*)
        `)
        .single();
      item = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) throw error;
    if (!item) throw new Error('Failed to create moodboard item');

    return mapItemRecord(item);
  },

  /**
   * Update an item's geometry or content.
   */
  async updateItem(
    id: string,
    input: {
      content?: Json;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      zIndex?: number;
    }
  ): Promise<MoodboardItem> {
    const supabase = createClient();

    const payload: MoodboardItemUpdate = {};
    if (input.content !== undefined) payload.content = input.content;
    if (input.x !== undefined) payload.x = input.x;
    if (input.y !== undefined) payload.y = input.y;
    if (input.width !== undefined) payload.width = input.width;
    if (input.height !== undefined) payload.height = input.height;
    if (input.zIndex !== undefined) payload.z_index = input.zIndex;

    const { data: item, error } = await supabase
      .from('moodboard_items')
      .update(payload)
      .eq('id', id)
      .select(`
        *,
        references (*)
      `)
      .single();

    if (error) throw error;

    const ref = item.references as unknown as Reference | null;
    return {
      id: item.id,
      project_id: item.project_id,
      reference_id: item.reference_id,
      type: item.type as MoodboardItem['type'],
      content: (item.content as unknown as MoodboardItem['content']) || {},
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      z_index: item.z_index,
      created_at: item.created_at,
      updated_at: item.updated_at,
      deleted_at: item.deleted_at,
      reference: ref && typeof ref === 'object' && 'id' in ref ? ref : null,
    };
  },

  /**
   * Soft-delete an item from the moodboard (moves to trash).
   */
  async softDeleteItem(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('moodboard_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Delete an item from the moodboard (defaults to soft delete).
   */
  async deleteItem(id: string): Promise<void> {
    return this.softDeleteItem(id);
  },

  /**
   * Restore a soft-deleted item from the trash.
   */
  async restoreItem(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('moodboard_items')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Permanently delete an item from the database.
   */
  async permanentlyDeleteItem(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('moodboard_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
