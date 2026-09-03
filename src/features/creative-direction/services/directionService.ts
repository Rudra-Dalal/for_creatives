import { createClient } from '@/lib/supabase/client';
import type {
  DirectionNote,
  DirectionNoteInsert,
  DirectionNoteUpdate,
  DirectionNoteWithReferences,
} from '../types';
import type { Reference } from '@/features/references/types';

export const directionService = {
  /**
   * Fetch all creative direction notes for a project,
   * including their linked references.
   */
  async getDirectionNotes(projectId: string): Promise<DirectionNoteWithReferences[]> {
    const supabase = createClient();

    // 1. Fetch active (non-deleted) notes
    const { data: notes, error: notesError } = await supabase
      .from('direction_notes')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

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
        // Supabase returns the joined single object or array
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
   */
  async createDirectionNote(input: {
    projectId: string;
    title: string;
    description?: string;
    referenceIds?: string[];
  }): Promise<DirectionNoteWithReferences> {
    const supabase = createClient();

    const payload: DirectionNoteInsert = {
      project_id: input.projectId,
      title: input.title.trim(),
      description: input.description?.trim() || '',
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
   */
  async updateDirectionNote(
    id: string,
    input: {
      title?: string;
      description?: string;
      referenceIds?: string[];
    }
  ): Promise<DirectionNoteWithReferences> {
    const supabase = createClient();

    const payload: DirectionNoteUpdate = {};
    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.description !== undefined) payload.description = input.description.trim();

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
