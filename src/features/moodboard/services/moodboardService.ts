import { createClient } from '@/lib/supabase/client';
import type { Database, Json } from '@/types/database.types';
import type { MoodboardItem, MoodboardItemInsert, MoodboardItemUpdate } from '../types';
import type { Reference } from '@/features/references/types';

export const moodboardService = {
  /**
   * Fetch all moodboard canvas items for a project,
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
      .order('z_index', { ascending: true });

    if (error) throw error;
    if (!items) return [];

    return items.map((item) => {
      const ref = item.references as unknown as Reference | null;
      return {
        id: item.id,
        project_id: item.project_id,
        reference_id: item.reference_id,
        type: item.type as 'reference' | 'text',
        content: (item.content as unknown as MoodboardItem['content']) || {},
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        z_index: item.z_index,
        created_at: item.created_at,
        updated_at: item.updated_at,
        reference: ref && typeof ref === 'object' && 'id' in ref ? ref : null,
      };
    });
  },

  /**
   * Create a new moodboard canvas item.
   */
  async createItem(input: {
    projectId: string;
    referenceId?: string | null;
    type: 'reference' | 'text';
    content?: Json;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    zIndex?: number;
  }): Promise<MoodboardItem> {
    const supabase = createClient();

    const payload: MoodboardItemInsert = {
      project_id: input.projectId,
      reference_id: input.referenceId || null,
      type: input.type,
      content: input.content || {},
      x: input.x ?? 0,
      y: input.y ?? 0,
      width: input.width ?? (input.type === 'reference' ? 280 : 220),
      height: input.height ?? (input.type === 'reference' ? 210 : 160),
      z_index: input.zIndex ?? 1,
    };

    const { data: item, error } = await supabase
      .from('moodboard_items')
      .insert(payload)
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
      type: item.type as 'reference' | 'text',
      content: (item.content as unknown as MoodboardItem['content']) || {},
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      z_index: item.z_index,
      created_at: item.created_at,
      updated_at: item.updated_at,
      reference: ref && typeof ref === 'object' && 'id' in ref ? ref : null,
    };
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
      type: item.type as 'reference' | 'text',
      content: (item.content as unknown as MoodboardItem['content']) || {},
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      z_index: item.z_index,
      created_at: item.created_at,
      updated_at: item.updated_at,
      reference: ref && typeof ref === 'object' && 'id' in ref ? ref : null,
    };
  },

  /**
   * Delete an item from the moodboard.
   */
  async deleteItem(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('moodboard_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
