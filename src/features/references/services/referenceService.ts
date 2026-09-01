import { createClient } from '@/lib/supabase/client';
import type { Reference, ReferenceInsert, ReferenceUpdate } from '../types';
import type { ScrapedMetadata } from '@/types/common';
import { extractDomain, normalizeUrl } from '@/lib/utils/url';

export const referenceService = {
  /**
   * Scrapes metadata for a given URL via server-side /api/metadata route.
   */
  async scrapeMetadata(url: string): Promise<{
    data: ScrapedMetadata;
    success: boolean;
    fallbackNeeded: boolean;
  }> {
    const normalized = normalizeUrl(url);
    try {
      const res = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      });

      const json = await res.json();
      if (!res.ok) {
        return {
          data: {
            url: normalized,
            title: extractDomain(normalized),
            thumbnail_url: '',
            source_domain: extractDomain(normalized),
            fallbackNeeded: true,
          },
          success: false,
          fallbackNeeded: true,
        };
      }

      return {
        data: json.data,
        success: !!json.success,
        fallbackNeeded: !!json.fallbackNeeded,
      };
    } catch {
      return {
        data: {
          url: normalized,
          title: extractDomain(normalized),
          thumbnail_url: '',
          source_domain: extractDomain(normalized),
          fallbackNeeded: true,
        },
        success: false,
        fallbackNeeded: true,
      };
    }
  },

  /**
   * Fetch all active (non-deleted) references belonging to a specific project.
   */
  async getReferencesByProjectId(projectId: string): Promise<Reference[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('references')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch all soft-deleted references in the trash for a specific project.
   */
  async getTrashReferences(projectId: string): Promise<Reference[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('references')
      .select('*')
      .eq('project_id', projectId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch a single reference by ID.
   */
  async getReferenceById(id: string): Promise<Reference | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('references')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  /**
   * Create a new reference record.
   */
  async createReference(input: {
    projectId: string;
    url: string;
    title: string;
    thumbnailUrl?: string;
    sourceDomain?: string;
    note?: string;
    tags?: string[];
  }): Promise<Reference> {
    const supabase = createClient();
    const domain = input.sourceDomain || extractDomain(input.url);

    const payload: ReferenceInsert = {
      project_id: input.projectId,
      url: input.url.trim(),
      title: input.title.trim(),
      thumbnail_url: input.thumbnailUrl?.trim() || '',
      source_domain: domain,
      note: input.note?.trim() || '',
      tags: input.tags || [],
    };

    const { data, error } = await supabase
      .from('references')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing reference.
   */
  async updateReference(
    id: string,
    input: {
      title?: string;
      thumbnailUrl?: string;
      note?: string;
      tags?: string[];
    }
  ): Promise<Reference> {
    const supabase = createClient();
    const payload: ReferenceUpdate = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.thumbnailUrl !== undefined) payload.thumbnail_url = input.thumbnailUrl.trim();
    if (input.note !== undefined) payload.note = input.note.trim();
    if (input.tags !== undefined) payload.tags = input.tags;

    const { data, error } = await supabase
      .from('references')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Soft-delete a reference (moves to trash).
   */
  async softDeleteReference(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('references')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Delete a reference by ID (defaults to soft delete).
   */
  async deleteReference(id: string): Promise<void> {
    return this.softDeleteReference(id);
  },

  /**
   * Restore a soft-deleted reference from trash.
   */
  async restoreReference(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('references')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Permanently delete a reference from the database.
   */
  async permanentlyDeleteReference(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('references')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
