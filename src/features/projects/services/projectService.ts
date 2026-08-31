import { createClient } from '@/lib/supabase/client';
import type { Project, ProjectInsert, ProjectUpdate } from '../types';

export const projectService = {
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
        // No rows returned
        return null;
      }
      throw error;
    }
    return data;
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
