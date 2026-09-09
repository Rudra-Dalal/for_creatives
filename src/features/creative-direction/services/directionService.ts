import { createClient } from '@/lib/supabase/client';
import type {
  DirectionNote,
  DirectionNoteInsert,
  DirectionNoteUpdate,
  DirectionNoteWithReferences,
  DirectionCategory,
} from '../types';
import type { Reference } from '@/features/references/types';

export const directionService = {
  /**
   * Fetch all creative direction notes for a project,
   * ordered by display_order ascending, including their linked references.
   */
  async getDirectionNotes(projectId: string): Promise<DirectionNoteWithReferences[]> {
    const supabase = createClient();

    // 1. Fetch active (non-deleted) notes ordered by display_order
    const { data: notes, error: notesError } = await supabase
      .from('direction_notes')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (notesError) throw notesError;
    if (!notes || notes.length === 0) return [];

    const noteIds = notes.map((n) => n.id);

    // 2. Fetch all links for these notes with joined reference details
    const { data: links, error: linksError } = await supabase
      .from('direction_reference_links')
      .select(`
        direction_note_id,
        reference_id,
        references (*)
      `)
      .in('direction_note_id', noteIds);

    if (linksError) throw linksError;

    // 3. Map references onto each direction note
    const notesMap = new Map<string, DirectionNoteWithReferences>();
    for (const note of notes) {
      notesMap.set(note.id, {
        ...note,
        references: [],
      });
    }

    if (links) {
      for (const link of links) {
        const note = notesMap.get(link.direction_note_id);
        const ref = link.references as unknown as Reference | null;
        if (note && ref && typeof ref === 'object' && 'id' in ref) {
          note.references.push(ref);
        }
      }
    }

    return Array.from(notesMap.values());
  },

  /**
   * Fetch all soft-deleted direction notes in trash for a project.
   */
  async getTrashNotes(projectId: string): Promise<DirectionNoteWithReferences[]> {
    const supabase = createClient();

    const { data: notes, error: notesError } = await supabase
      .from('direction_notes')
      .select('*')
      .eq('project_id', projectId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (notesError) throw notesError;
    if (!notes || notes.length === 0) return [];

    const noteIds = notes.map((n) => n.id);

    const { data: links, error: linksError } = await supabase
      .from('direction_reference_links')
      .select(`
        direction_note_id,
        reference_id,
        references (*)
      `)
      .in('direction_note_id', noteIds);

    if (linksError) throw linksError;

    const notesMap = new Map<string, DirectionNoteWithReferences>();
    for (const note of notes) {
      notesMap.set(note.id, {
        ...note,
        references: [],
      });
    }

    if (links) {
      for (const link of links) {
        const note = notesMap.get(link.direction_note_id);
        const ref = link.references as unknown as Reference | null;
        if (note && ref && typeof ref === 'object' && 'id' in ref) {
          note.references.push(ref);
        }
      }
    }

    return Array.from(notesMap.values());
  },

  /**
   * Fetch a single direction note by ID with its linked references.
   */
  async getDirectionNoteById(id: string): Promise<DirectionNoteWithReferences | null> {
    const supabase = createClient();

    const { data: note, error: noteError } = await supabase
      .from('direction_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (noteError) {
      if (noteError.code === 'PGRST116') return null;
      throw noteError;
    }

    const { data: links, error: linksError } = await supabase
      .from('direction_reference_links')
      .select(`
        reference_id,
        references (*)
      `)
      .eq('direction_note_id', id);

    if (linksError) throw linksError;

    const references: Reference[] = [];
    if (links) {
      for (const link of links) {
        const ref = link.references as unknown as Reference | null;
        if (ref && typeof ref === 'object' && 'id' in ref) {
          references.push(ref);
        }
      }
    }

    return {
      ...note,
      references,
    };
  },

  /**
   * Create a new direction note and optionally link initial references.
   * Automatically computes display_order to place the note at the end of its category group.
   */
  async createDirectionNote(input: {
    projectId: string;
    title: string;
    description?: string;
    category?: DirectionCategory | null;
    displayOrder?: number;
    referenceIds?: string[];
  }): Promise<DirectionNoteWithReferences> {
    const supabase = createClient();

    let targetOrder = input.displayOrder;
    if (targetOrder === undefined) {
      let orderQuery = supabase
        .from('direction_notes')
        .select('display_order')
        .eq('project_id', input.projectId)
        .is('deleted_at', null);

      if (input.category) {
        orderQuery = orderQuery.eq('category', input.category);
      } else {
        orderQuery = orderQuery.is('category', null);
      }

      const { data: existing } = await orderQuery
        .order('display_order', { ascending: false })
        .limit(1);

      targetOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;
    }

    const payload: DirectionNoteInsert = {
      project_id: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() || '',
      category: input.category || null,
      display_order: targetOrder,
    };

    const { data: note, error: noteError } = await supabase
      .from('direction_notes')
      .insert(payload)
      .select()
      .single();

    if (noteError) throw noteError;

    // Link references if provided
    let linkedReferences: Reference[] = [];
    if (input.referenceIds && input.referenceIds.length > 0) {
      const linkPayloads = input.referenceIds.map((refId) => ({
        direction_note_id: note.id,
        reference_id: refId,
      }));

      const { error: linkError } = await supabase
        .from('direction_reference_links')
        .insert(linkPayloads);

      if (linkError) throw linkError;

      // Fetch the linked references
      const { data: refs } = await supabase
        .from('references')
        .select('*')
        .in('id', input.referenceIds);

      if (refs) {
        linkedReferences = refs;
      }
    }

    return {
      ...note,
      references: linkedReferences,
    };
  },

  /**
   * Update an existing direction note and sync its linked references.
   * If category changes and displayOrder is not provided, places at bottom of new category.
   */
  async updateDirectionNote(
    id: string,
    input: {
      title?: string;
      description?: string;
      category?: DirectionCategory | null;
      displayOrder?: number;
      referenceIds?: string[];
    }
  ): Promise<DirectionNoteWithReferences> {
    const supabase = createClient();

    const payload: DirectionNoteUpdate = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.description !== undefined) payload.description = input.description.trim();

    if (input.category !== undefined) {
      payload.category = input.category || null;

      // If category is changing and displayOrder not explicitly provided, place at bottom of category
      if (input.displayOrder === undefined) {
        // Fetch current note to check if category changed
        const current = await directionService.getDirectionNoteById(id);
        if (current && current.category !== payload.category) {
          let orderQuery = supabase
            .from('direction_notes')
            .select('display_order')
            .eq('project_id', current.project_id)
            .is('deleted_at', null);

          if (payload.category) {
            orderQuery = orderQuery.eq('category', payload.category);
          } else {
            orderQuery = orderQuery.is('category', null);
          }

          const { data: existing } = await orderQuery
            .order('display_order', { ascending: false })
            .limit(1);

          payload.display_order = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;
        }
      }
    }

    if (input.displayOrder !== undefined) {
      payload.display_order = input.displayOrder;
    }

    const { data: note, error: noteError } = await supabase
      .from('direction_notes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (noteError) throw noteError;

    // Sync references if referenceIds was explicitly passed
    if (input.referenceIds !== undefined) {
      // 1. Delete current links
      const { error: deleteError } = await supabase
        .from('direction_reference_links')
        .delete()
        .eq('direction_note_id', id);

      if (deleteError) throw deleteError;

      // 2. Insert new links
      if (input.referenceIds.length > 0) {
        const linkPayloads = input.referenceIds.map((refId) => ({
          direction_note_id: id,
          reference_id: refId,
        }));

        const { error: insertError } = await supabase
          .from('direction_reference_links')
          .insert(linkPayloads);

        if (insertError) throw insertError;
      }
    }

    // Re-fetch full note with references
    const fullNote = await directionService.getDirectionNoteById(id);
    if (!fullNote) {
      throw new Error('Direction note not found after update');
    }
    return fullNote;
  },

  /**
   * Duplicate a direction note:
   * Copies title, description, and category, places it at the bottom of the same category,
   * and starts with zero linked references.
   */
  async duplicateDirectionNote(id: string): Promise<DirectionNoteWithReferences> {
    const original = await directionService.getDirectionNoteById(id);
    if (!original) {
      throw new Error('Direction note not found for duplication');
    }

    return directionService.createDirectionNote({
      projectId: original.project_id,
      title: original.title,
      description: original.description,
      category: original.category as DirectionCategory | null,
      referenceIds: [],
    });
  },

  /**
   * Reorder a direction note up or down within its category group.
   * Swaps display_order with the adjacent active note in the same category.
   */
  async reorderDirectionNote(id: string, direction: 'up' | 'down'): Promise<void> {
    const supabase = createClient();

    const note = await directionService.getDirectionNoteById(id);
    if (!note) return;

    // Fetch all active notes in the same project and category
    let query = supabase
      .from('direction_notes')
      .select('id, display_order, created_at')
      .eq('project_id', note.project_id)
      .is('deleted_at', null);

    if (note.category) {
      query = query.eq('category', note.category);
    } else {
      query = query.is('category', null);
    }

    const { data: siblings, error } = await query
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !siblings || siblings.length <= 1) return;

    const currentIndex = siblings.findIndex((s) => s.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const currentSibling = siblings[currentIndex];
    const targetSibling = siblings[targetIndex];

    let currentOrder = currentSibling.display_order;
    let targetOrder = targetSibling.display_order;

    // If both have the same display_order, normalize whole list first
    if (currentOrder === targetOrder) {
      currentOrder = currentIndex;
      targetOrder = targetIndex;
    }

    // Swap display_order
    const { error: err1 } = await supabase
      .from('direction_notes')
      .update({ display_order: targetOrder })
      .eq('id', currentSibling.id);

    if (err1) throw err1;

    const { error: err2 } = await supabase
      .from('direction_notes')
      .update({ display_order: currentOrder })
      .eq('id', targetSibling.id);

    if (err2) throw err2;
  },

  /**
   * Soft-delete a direction note (moves to trash, preserves relationships).
   */
  async softDeleteDirectionNote(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('direction_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Delete a direction note (defaults to soft delete).
   */
  async deleteDirectionNote(id: string): Promise<void> {
    return this.softDeleteDirectionNote(id);
  },

  /**
   * Restore a soft-deleted direction note from trash.
   */
  async restoreDirectionNote(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('direction_notes')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Permanently delete a direction note from the database.
   */
  async permanentlyDeleteDirectionNote(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('direction_notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Bidirectional Query 1:
   * "What did this reference influence?"
   * Fetches all direction notes linked to a specific reference.
   */
  async getDirectionNotesForReference(referenceId: string): Promise<DirectionNote[]> {
    const supabase = createClient();

    const { data: links, error } = await supabase
      .from('direction_reference_links')
      .select(`
        direction_note_id,
        direction_notes (*)
      `)
      .eq('reference_id', referenceId);

    if (error) throw error;
    if (!links) return [];

    const notes: DirectionNote[] = [];
    for (const link of links) {
      const note = link.direction_notes as unknown as DirectionNote | null;
      if (note && typeof note === 'object' && 'id' in note) {
        notes.push(note);
      }
    }
    return notes;
  },

  /**
   * Bidirectional Query 2:
   * "What references justify this creative direction?"
   * Fetches all references linked to a specific direction note.
   */
  async getReferencesForDirectionNote(directionNoteId: string): Promise<Reference[]> {
    const supabase = createClient();

    const { data: links, error } = await supabase
      .from('direction_reference_links')
      .select(`
        reference_id,
        references (*)
      `)
      .eq('direction_note_id', directionNoteId);

    if (error) throw error;
    if (!links) return [];

    const references: Reference[] = [];
    for (const link of links) {
      const ref = link.references as unknown as Reference | null;
      if (ref && typeof ref === 'object' && 'id' in ref) {
        references.push(ref);
      }
    }
    return references;
  },

  /**
   * Link a single reference to a direction note.
   */
  async linkReference(directionNoteId: string, referenceId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('direction_reference_links')
      .insert({
        direction_note_id: directionNoteId,
        reference_id: referenceId,
      });

    if (error) {
      // If error code is unique violation (already linked), ignore
      if (error.code === '23505') return;
      throw error;
    }
  },

  /**
   * Unlink a reference from a direction note.
   */
  async unlinkReference(directionNoteId: string, referenceId: string): Promise<void> {
    const supabase = createClient();

    const { error } = await supabase
      .from('direction_reference_links')
      .delete()
      .eq('direction_note_id', directionNoteId)
      .eq('reference_id', referenceId);

    if (error) throw error;
  },
};
