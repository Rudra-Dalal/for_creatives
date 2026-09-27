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
  StoryboardShotConnection,
  StoryboardShotConnectionInsert,
  StoryboardStroke,
  StoryboardStrokeInsert,
  AnchorPosition,
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
    x?: number;
    y?: number;
    width?: number;
    height?: number;
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
      x: input.x !== undefined ? input.x : 100,
      y: input.y !== undefined ? input.y : 100,
      width: input.width !== undefined ? input.width : 880,
      height: input.height !== undefined ? input.height : 560,
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
   * Update an existing scene's title, description, or spatial geometry.
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
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    zIndex?: number;
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
      x: input.x !== undefined ? input.x : 140,
      y: input.y !== undefined ? input.y : 160,
      width: input.width !== undefined ? input.width : 280,
      height: input.height !== undefined ? input.height : 220,
      z_index: input.zIndex !== undefined ? input.zIndex : 0,
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

  /**
   * Update a shot's spatial world coordinates on the canvas.
   */
  async updateShotPosition(
    id: string,
    x: number,
    y: number,
    zIndex?: number
  ): Promise<void> {
    const supabase = createClient();

    const updates: Partial<StoryboardShotUpdate> = { x, y };
    if (zIndex !== undefined) updates.z_index = zIndex;

    const { error } = await supabase
      .from('storyboard_shots')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Batch update spatial positions for multiple shots (e.g. when moving a scene or multi-selected shots).
   */
  async batchUpdateShotPositions(
    updates: Array<{ id: string; x: number; y: number; zIndex?: number }>
  ): Promise<void> {
    if (updates.length === 0) return;
    const supabase = createClient();

    const promises = updates.map((u) => {
      const payload: Partial<StoryboardShotUpdate> = { x: u.x, y: u.y };
      if (u.zIndex !== undefined) payload.z_index = u.zIndex;
      return supabase
        .from('storyboard_shots')
        .update(payload)
        .eq('id', u.id);
    });

    const results = await Promise.all(promises);
    for (const res of results) {
      if (res.error) throw res.error;
    }
  },

  // --------------------------------------------------------------------------
  // SEQUENCE CONNECTION OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Fetch all active (non-deleted) sequence connections for a project.
   * Results are deterministically ordered by creation time.
   */
  async getConnections(projectId: string): Promise<StoryboardShotConnection[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('storyboard_shot_connections')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as StoryboardShotConnection[];
  },

  /**
   * Create a directed sequence connection between two shots (A → B).
   *
   * Soft-delete / unique constraint safety:
   * The DB enforces UNIQUE(from_shot_id, to_shot_id) across all rows including
   * soft-deleted ones.  Therefore we must:
   *  1. Reject A → A self-connections immediately.
   *  2. Check for an existing active A → B: return a DuplicateConnection error.
   *  3. Check for a soft-deleted A → B: restore it (update deleted_at = null,
   *     anchors, label) instead of INSERTing a second row that would violate
   *     the unique constraint.
   *  4. Otherwise INSERT normally.
   */
  async createConnection(input: {
    projectId: string;
    fromShotId: string;
    toShotId: string;
    fromAnchor?: AnchorPosition;
    toAnchor?: AnchorPosition;
    transitionLabel?: string;
  }): Promise<StoryboardShotConnection> {
    // 1. Self-connection guard
    if (input.fromShotId === input.toShotId) {
      throw new Error('SelfConnection: cannot connect a shot to itself');
    }

    const supabase = createClient();
    const fromAnchor: AnchorPosition = input.fromAnchor || 'right';
    const toAnchor: AnchorPosition = input.toAnchor || 'left';
    const transitionLabel = input.transitionLabel?.trim() || '';

    // 2. Look up any existing row (active or soft-deleted) for this directed pair
    const { data: existing, error: lookupError } = await supabase
      .from('storyboard_shot_connections')
      .select('*')
      .eq('from_shot_id', input.fromShotId)
      .eq('to_shot_id', input.toShotId)
      .limit(1);

    if (lookupError) throw lookupError;

    const existingRow = (existing && existing.length > 0)
      ? existing[0] as StoryboardShotConnection
      : null;

    if (existingRow) {
      if (!existingRow.deleted_at) {
        // 2a. Active duplicate — reject explicitly
        throw new Error(
          'DuplicateConnection: an active connection from this shot to the target already exists'
        );
      }

      // 2b. Soft-deleted row — restore it instead of inserting (avoids unique violation)
      const { data: restored, error: restoreError } = await supabase
        .from('storyboard_shot_connections')
        .update({
          deleted_at: null,
          from_anchor: fromAnchor,
          to_anchor: toAnchor,
          transition_label: transitionLabel,
        })
        .eq('id', existingRow.id)
        .select()
        .single();

      if (restoreError) throw restoreError;
      return restored as StoryboardShotConnection;
    }

    // 3. No existing row — safe to INSERT
    const payload: StoryboardShotConnectionInsert = {
      project_id: input.projectId,
      from_shot_id: input.fromShotId,
      to_shot_id: input.toShotId,
      from_anchor: fromAnchor,
      to_anchor: toAnchor,
      transition_label: transitionLabel,
    };

    const { data, error } = await supabase
      .from('storyboard_shot_connections')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as StoryboardShotConnection;
  },

  /**
   * Update a sequence connection's mutable display fields.
   *
   * Only from_anchor, to_anchor, and transition_label may be changed.
   * Structural fields (ids, timestamps, project, deleted_at) are explicitly
   * stripped to prevent accidental state corruption.
   */
  async updateConnection(
    id: string,
    input: {
      fromAnchor?: AnchorPosition;
      toAnchor?: AnchorPosition;
      transitionLabel?: string;
    }
  ): Promise<StoryboardShotConnection> {
    const supabase = createClient();

    // Allowlist: only send the fields that are permitted to change
    const payload: Record<string, unknown> = {};
    if (input.fromAnchor !== undefined) payload.from_anchor = input.fromAnchor;
    if (input.toAnchor !== undefined) payload.to_anchor = input.toAnchor;
    if (input.transitionLabel !== undefined) payload.transition_label = input.transitionLabel.trim();

    if (Object.keys(payload).length === 0) {
      throw new Error('updateConnection: no mutable fields provided');
    }

    const { data, error } = await supabase
      .from('storyboard_shot_connections')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as StoryboardShotConnection;
  },

  /**
   * Soft-delete a sequence connection by setting deleted_at.
   */
  async deleteConnection(id: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('storyboard_shot_connections')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Restore a previously soft-deleted connection.
   * Used by undo operations to reinstate a deleted connection.
   */
  async restoreConnection(id: string): Promise<StoryboardShotConnection> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('storyboard_shot_connections')
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as StoryboardShotConnection;
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

  // --------------------------------------------------------------------------
  // CANVAS STROKE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Fetch all active (non-deleted) canvas annotation strokes for a project.
   * Deterministically ordered by creation timestamp ascending.
   */
  async getStrokes(projectId: string): Promise<StoryboardStroke[]> {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      throw new Error('getStrokes: projectId is required');
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('storyboard_strokes')
      .select('*')
      .eq('project_id', projectId.trim())
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`getStrokes: ${error.message}`);
    }

    return (data || []) as StoryboardStroke[];
  },

  /**
   * Insert a new canvas stroke for a project.
   * Points and stroke width must be pre-transformed into world coordinates.
   */
  async createStroke(input: {
    projectId: string;
    points: number[];
    strokeColor: string;
    strokeWidth: number;
  }): Promise<StoryboardStroke> {
    if (!input.projectId || typeof input.projectId !== 'string' || !input.projectId.trim()) {
      throw new Error('createStroke: projectId is required');
    }

    if (
      !Array.isArray(input.points) ||
      input.points.length < 4 ||
      input.points.length % 2 !== 0 ||
      !input.points.every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      throw new Error(
        'createStroke: points must be a valid flat coordinate array with at least 2 points'
      );
    }

    if (
      typeof input.strokeWidth !== 'number' ||
      !Number.isFinite(input.strokeWidth) ||
      input.strokeWidth <= 0
    ) {
      throw new Error('createStroke: strokeWidth must be a positive finite number');
    }

    if (!input.strokeColor || typeof input.strokeColor !== 'string' || !input.strokeColor.trim()) {
      throw new Error('createStroke: strokeColor must be a non-empty string');
    }

    const supabase = createClient();
    const payload: StoryboardStrokeInsert = {
      project_id: input.projectId.trim(),
      points: input.points,
      stroke_color: input.strokeColor.trim(),
      stroke_width: input.strokeWidth,
    };

    const { data, error } = await supabase
      .from('storyboard_strokes')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`createStroke: ${error.message}`);
    }

    return data as StoryboardStroke;
  },

  /**
   * Soft-delete a canvas stroke by setting deleted_at.
   */
  async softDeleteStroke(id: string): Promise<StoryboardStroke> {
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new Error('softDeleteStroke: stroke id is required');
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from('storyboard_strokes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id.trim())
      .select()
      .single();

    if (error) {
      throw new Error(`softDeleteStroke: ${error.message}`);
    }

    return data as StoryboardStroke;
  },
};
