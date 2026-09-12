import { createClient } from '@/lib/supabase/client';
import type {
  StoryboardScene,
  StoryboardSceneInsert,
  StoryboardSceneUpdate,
  StoryboardSceneWithShots,
  StoryboardShot,
  StoryboardShotInsert,
  StoryboardShotUpdate,
  StoryboardShotWithLinks,
  AspectRatio,
  ShotType,
  CameraMovement,
  ShotVisualSource,
  ShotSketchData,
} from '../types';
import type { Reference } from '@/features/references/types';
import type { DirectionNote } from '@/features/creative-direction/types';
import type { Json } from '@/types/database.types';

export const storyboardService = {
  /**
   * Fetch all active scenes and their shots with joined reference and direction links.
   * Ordered by scene display_order, then shot display_order.
   */
  async getScenesWithShots(projectId: string): Promise<StoryboardSceneWithShots[]> {
    const supabase = createClient();

    // 1. Fetch active scenes
    const { data: scenes, error: scenesError } = await supabase
      .from('storyboard_scenes')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (scenesError) throw scenesError;
    if (!scenes || scenes.length === 0) return [];

    const sceneIds = scenes.map((s) => s.id);

    // 2. Fetch active shots for these scenes
    const { data: shots, error: shotsError } = await supabase
      .from('storyboard_shots')
      .select('*')
      .in('scene_id', sceneIds)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (shotsError) throw shotsError;

    const shotIds = (shots || []).map((s) => s.id);

    // 3. Fetch reference links for these shots with joined reference data
    let shotReferenceMap = new Map<string, Reference[]>();
    if (shotIds.length > 0) {
      const { data: refLinks, error: refLinksError } = await supabase
        .from('storyboard_shot_references')
        .select(`
          shot_id,
          reference_id,
          references (*)
        `)
        .in('shot_id', shotIds);

      if (refLinksError) throw refLinksError;

      if (refLinks) {
        for (const link of refLinks) {
          const ref = link.references as unknown as Reference | null;
          if (ref && typeof ref === 'object' && 'id' in ref && !ref.deleted_at) {
            const current = shotReferenceMap.get(link.shot_id) || [];
            current.push(ref);
            shotReferenceMap.set(link.shot_id, current);
          }
        }
      }
    }

    // 4. Fetch direction links for these shots with joined direction note data
    let shotDirectionMap = new Map<string, DirectionNote[]>();
    if (shotIds.length > 0) {
      const { data: dirLinks, error: dirLinksError } = await supabase
        .from('storyboard_shot_direction_links')
        .select(`
          shot_id,
          direction_note_id,
          direction_notes (*)
        `)
        .in('shot_id', shotIds);

      if (dirLinksError) throw dirLinksError;

      if (dirLinks) {
        for (const link of dirLinks) {
          const note = link.direction_notes as unknown as DirectionNote | null;
          if (note && typeof note === 'object' && 'id' in note && !note.deleted_at) {
            const current = shotDirectionMap.get(link.shot_id) || [];
            current.push(note);
            shotDirectionMap.set(link.shot_id, current);
          }
        }
      }
    }

    // 5. Assemble composite shots
    const shotsByScene = new Map<string, StoryboardShotWithLinks[]>();
    for (const s of scenes) {
      shotsByScene.set(s.id, []);
    }

    if (shots) {
      for (const shot of shots) {
        const compositeShot: StoryboardShotWithLinks = {
          ...shot,
          aspect_ratio: shot.aspect_ratio as AspectRatio,
          visual_source: shot.visual_source as ShotVisualSource,
          references: shotReferenceMap.get(shot.id) || [],
          direction_notes: shotDirectionMap.get(shot.id) || [],
        };
        const list = shotsByScene.get(shot.scene_id);
        if (list) {
          list.push(compositeShot);
        }
      }
    }

    // 6. Assemble scenes with composite shots
    return scenes.map((scene) => ({
      ...scene,
      shots: shotsByScene.get(scene.id) || [],
    }));
  },

  // --------------------------------------------------------------------------
  // SCENE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Create a new scene in the project.
   */
  async createScene(input: {
    projectId: string;
    title?: string;
    description?: string;
    displayOrder?: number;
  }): Promise<StoryboardScene> {
    const supabase = createClient();

    let targetOrder = input.displayOrder;
    if (targetOrder === undefined) {
      const { data: existing } = await supabase
        .from('storyboard_scenes')
        .select('display_order')
        .eq('project_id', input.projectId)
        .is('deleted_at', null)
        .order('display_order', { ascending: false })
        .limit(1);

      targetOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;
    }

    const payload: StoryboardSceneInsert = {
      project_id: input.projectId,
      title: input.title?.trim() || 'Scene 1',
      description: input.description?.trim() || '',
      display_order: targetOrder,
    };

    const { data: scene, error } = await supabase
      .from('storyboard_scenes')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return scene;
  },

  /**
   * Update an existing scene's title or description.
   */
  async updateScene(id: string, input: Partial<StoryboardSceneUpdate>): Promise<StoryboardScene> {
    const supabase = createClient();

    const { data: scene, error } = await supabase
      .from('storyboard_scenes')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return scene;
  },

  /**
   * Soft-delete a scene and all its child shots.
   */
  async deleteScene(id: string): Promise<void> {
    const supabase = createClient();
    const now = new Date().toISOString();

    // 1. Soft-delete the scene
    const { error: sceneError } = await supabase
      .from('storyboard_scenes')
      .update({ deleted_at: now })
      .eq('id', id);

    if (sceneError) throw sceneError;

    // 2. Soft-delete all child shots of this scene
    const { error: shotsError } = await supabase
      .from('storyboard_shots')
      .update({ deleted_at: now })
      .eq('scene_id', id)
      .is('deleted_at', null);

    if (shotsError) throw shotsError;
  },

  /**
   * Batch update display_order for scenes within a project.
   */
  async reorderScenes(projectId: string, sceneIds: string[]): Promise<void> {
    const supabase = createClient();

    const updates = sceneIds.map((id, index) =>
      supabase
        .from('storyboard_scenes')
        .update({ display_order: index })
        .eq('id', id)
        .eq('project_id', projectId)
    );

    await Promise.all(updates);
  },

  // --------------------------------------------------------------------------
  // SHOT OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Create a new shot inside a scene.
   */
  async createShot(input: {
    projectId: string;
    sceneId: string;
    shotNumber?: string;
    title?: string;
    description?: string;
    dialogue?: string;
    aspectRatio?: AspectRatio;
    shotType?: ShotType | null;
    cameraMovement?: CameraMovement | null;
    visualUrl?: string;
    visualSource?: ShotVisualSource;
    sketchData?: ShotSketchData | Json | null;
    displayOrder?: number;
    referenceIds?: string[];
    directionNoteIds?: string[];
  }): Promise<StoryboardShotWithLinks> {
    const supabase = createClient();

    let targetOrder = input.displayOrder;
    if (targetOrder === undefined) {
      const { data: existing } = await supabase
        .from('storyboard_shots')
        .select('display_order')
        .eq('scene_id', input.sceneId)
        .is('deleted_at', null)
        .order('display_order', { ascending: false })
        .limit(1);

      targetOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;
    }

    const payload: StoryboardShotInsert = {
      project_id: input.projectId,
      scene_id: input.sceneId,
      shot_number: input.shotNumber || '',
      title: input.title?.trim() || '',
      description: input.description?.trim() || '',
      dialogue: input.dialogue?.trim() || '',
      aspect_ratio: input.aspectRatio || '16:9',
      shot_type: input.shotType || null,
      camera_movement: input.cameraMovement || null,
      visual_url: input.visualUrl || '',
      visual_source: input.visualSource || 'none',
      sketch_data: (input.sketchData as Json) || null,
      display_order: targetOrder,
    };

    const { data: shot, error: shotError } = await supabase
      .from('storyboard_shots')
      .insert(payload)
      .select()
      .single();

    if (shotError) throw shotError;

    // Optional initial reference links
    let references: Reference[] = [];
    if (input.referenceIds && input.referenceIds.length > 0) {
      const linkPayloads = input.referenceIds.map((refId) => ({
        shot_id: shot.id,
        reference_id: refId,
      }));
      await supabase.from('storyboard_shot_references').insert(linkPayloads);

      const { data: refs } = await supabase
        .from('references')
        .select('*')
        .in('id', input.referenceIds);
      if (refs) references = refs;
    }

    // Optional initial creative direction links
    let direction_notes: DirectionNote[] = [];
    if (input.directionNoteIds && input.directionNoteIds.length > 0) {
      const linkPayloads = input.directionNoteIds.map((dirId) => ({
        shot_id: shot.id,
        direction_note_id: dirId,
      }));
      await supabase.from('storyboard_shot_direction_links').insert(linkPayloads);

      const { data: notes } = await supabase
        .from('direction_notes')
        .select('*')
        .in('id', input.directionNoteIds);
      if (notes) direction_notes = notes;
    }

    return {
      ...shot,
      aspect_ratio: shot.aspect_ratio as AspectRatio,
      visual_source: shot.visual_source as ShotVisualSource,
      references,
      direction_notes,
    };
  },

  /**
   * Update a shot's core content, metadata, or visual frame.
   */
  async updateShot(id: string, input: Partial<StoryboardShotUpdate>): Promise<StoryboardShot> {
    const supabase = createClient();

    const { data: shot, error } = await supabase
      .from('storyboard_shots')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return shot;
  },

  /**
   * Soft-delete a shot.
   */
  async deleteShot(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_shots')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Batch update display_order for shots within a scene.
   */
  async reorderShots(sceneId: string, shotIds: string[]): Promise<void> {
    const supabase = createClient();

    const updates = shotIds.map((id, index) =>
      supabase
        .from('storyboard_shots')
        .update({ display_order: index })
        .eq('id', id)
        .eq('scene_id', sceneId)
    );

    await Promise.all(updates);
  },

  /**
   * Move a shot to a different scene and update its position.
   */
  async moveShotToScene(
    shotId: string,
    targetSceneId: string,
    newDisplayOrder: number
  ): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_shots')
      .update({
        scene_id: targetSceneId,
        display_order: newDisplayOrder,
      })
      .eq('id', shotId);

    if (error) throw error;
  },

  /**
   * Duplicate a shot within its parent scene.
   */
  async duplicateShot(shotId: string): Promise<StoryboardShotWithLinks> {
    const supabase = createClient();

    // 1. Fetch original shot
    const { data: original, error: fetchError } = await supabase
      .from('storyboard_shots')
      .select('*')
      .eq('id', shotId)
      .single();

    if (fetchError || !original) throw fetchError || new Error('Shot not found');

    // 2. Fetch existing reference links
    const { data: refLinks } = await supabase
      .from('storyboard_shot_references')
      .select('reference_id')
      .eq('shot_id', shotId);

    // 3. Fetch existing direction links
    const { data: dirLinks } = await supabase
      .from('storyboard_shot_direction_links')
      .select('direction_note_id')
      .eq('shot_id', shotId);

    // 4. Create duplicated shot immediately after original
    const duplicated = await this.createShot({
      projectId: original.project_id,
      sceneId: original.scene_id,
      shotNumber: original.shot_number ? `${original.shot_number} (copy)` : '',
      title: original.title ? `${original.title} (copy)` : '',
      description: original.description,
      dialogue: original.dialogue,
      aspectRatio: original.aspect_ratio as AspectRatio,
      shotType: original.shot_type as ShotType | null,
      cameraMovement: original.camera_movement as CameraMovement | null,
      visualUrl: original.visual_url,
      visualSource: original.visual_source as ShotVisualSource,
      sketchData: original.sketch_data,
      displayOrder: original.display_order + 1,
      referenceIds: refLinks?.map((r) => r.reference_id) || [],
      directionNoteIds: dirLinks?.map((d) => d.direction_note_id) || [],
    });

    return duplicated;
  },

  // --------------------------------------------------------------------------
  // JUNCTION LINK OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Link an existing project reference to a shot.
   */
  async linkReferenceToShot(shotId: string, referenceId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_shot_references')
      .insert({
        shot_id: shotId,
        reference_id: referenceId,
      });

    if (error && error.code !== '23505') {
      // Ignore unique violation (already linked)
      throw error;
    }
  },

  /**
   * Unlink a reference from a shot.
   */
  async unlinkReferenceFromShot(shotId: string, referenceId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_shot_references')
      .delete()
      .eq('shot_id', shotId)
      .eq('reference_id', referenceId);

    if (error) throw error;
  },

  /**
   * Link a creative direction note to a shot.
   */
  async linkDirectionToShot(shotId: string, directionNoteId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_shot_direction_links')
      .insert({
        shot_id: shotId,
        direction_note_id: directionNoteId,
      });

    if (error && error.code !== '23505') {
      throw error;
    }
  },

  /**
   * Unlink a creative direction note from a shot.
   */
  async unlinkDirectionFromShot(shotId: string, directionNoteId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_shot_direction_links')
      .delete()
      .eq('shot_id', shotId)
      .eq('direction_note_id', directionNoteId);

    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // TRASH / RESTORE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Fetch all soft-deleted storyboard scenes and shots for a project.
   */
  async getTrashItems(projectId: string): Promise<{
    scenes: StoryboardScene[];
    shots: StoryboardShot[];
  }> {
    const supabase = createClient();

    const [scenesRes, shotsRes] = await Promise.all([
      supabase
        .from('storyboard_scenes')
        .select('*')
        .eq('project_id', projectId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      supabase
        .from('storyboard_shots')
        .select('*')
        .eq('project_id', projectId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
    ]);

    if (scenesRes.error) throw scenesRes.error;
    if (shotsRes.error) throw shotsRes.error;

    return {
      scenes: scenesRes.data || [],
      shots: shotsRes.data || [],
    };
  },

  /**
   * Restore a soft-deleted scene.
   */
  async restoreScene(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_scenes')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Restore a soft-deleted shot.
   */
  async restoreShot(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_shots')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;
  },
};
