import { createClient } from '@/lib/supabase/client';
import type { Project, ProjectInsert, ProjectUpdate, SharedProjectBundle } from '../types';

export const projectService = {
  /**
   * Fetch a full shared project bundle by token using the hardened RPC function.
   * Returns project metadata, non-deleted references, moodboard items, and direction notes.
   */
  async getSharedProjectBundle(token: string): Promise<SharedProjectBundle | null> {
    if (!token) return null;
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_shared_project_bundle', {
      p_token: token.trim(),
    });

    if (error) {
      // Fallback if RPC function is not yet migrated in database
      const fallbackProject = await this.getProjectByShareToken(token);
      if (!fallbackProject) return null;
      return {
        project: fallbackProject,
      };
    }

    if (!data) return null;
    return data as unknown as SharedProjectBundle;
  },

  /**
   * Fetch all projects owned by current authenticated user.
   */
  async getProjects(): Promise<Project[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch a single project by ID.
   */
  async getProjectById(id: string): Promise<Project | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    return data;
  },

  /**
   * Fetch a single project by its public share token (Read-Only).
   */
  async getProjectByShareToken(token: string): Promise<Project | null> {
    if (!token) return null;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('share_token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    return data;
  },

  /**
   * Generate or regenerate a secure share token for a project.
   */
  async generateShareToken(projectId: string): Promise<string> {
    const supabase = createClient();
    // Generate a clean 16-character url-safe token
    const token = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).substring(2, 18);

    const { data, error } = await supabase
      .from('projects')
      .update({ share_token: token })
      .eq('id', projectId)
      .select('share_token')
      .single();

    if (error) throw error;
    return data.share_token || token;
  },

  /**
   * Revoke (nullify) the share link for a project.
   */
  async revokeShareToken(projectId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('projects')
      .update({ share_token: null })
      .eq('id', projectId);

    if (error) throw error;
  },

  /**
   * Create a new project for the authenticated user.
   */
  async createProject(input: { name: string; description?: string }): Promise<Project> {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('User must be authenticated to create a project');
    }

    const payload: ProjectInsert = {
      name: input.name.trim(),
      description: input.description?.trim() || '',
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing project.
   */
  async updateProject(id: string, input: { name?: string; description?: string }): Promise<Project> {
    const supabase = createClient();
    const payload: ProjectUpdate = {};
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.description !== undefined) payload.description = input.description.trim();

    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a project by ID.
   */
  async deleteProject(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
