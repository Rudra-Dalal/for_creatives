'use client';

import { useState, useEffect, useCallback } from 'react';
import { directionService } from '../services/directionService';
import type { DirectionNoteWithReferences } from '../types';
import type { CreateDirectionInput, UpdateDirectionInput } from '../validation/directionSchema';

export function useDirectionNotes(
  projectId: string,
  initialNotes?: DirectionNoteWithReferences[],
  readOnly?: boolean
) {
  const [directionNotes, setDirectionNotes] = useState<DirectionNoteWithReferences[]>(initialNotes || []);
  const [isLoading, setIsLoading] = useState(!initialNotes);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialNotes) {
      setDirectionNotes(initialNotes);
      setIsLoading(false);
    }
  }, [initialNotes]);

  const fetchDirectionNotes = useCallback(async () => {
    if (!projectId || (readOnly && initialNotes !== undefined)) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await directionService.getDirectionNotes(projectId);
      setDirectionNotes(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch creative direction notes');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, readOnly, initialNotes]);

  useEffect(() => {
    fetchDirectionNotes();
  }, [fetchDirectionNotes]);

  const createDirectionNote = async (
    input: CreateDirectionInput
  ): Promise<DirectionNoteWithReferences> => {
    const created = await directionService.createDirectionNote({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      category: input.category,
      displayOrder: input.displayOrder,
      referenceIds: input.referenceIds,
    });
    await fetchDirectionNotes();
    return created;
  };

  const updateDirectionNote = async (
    id: string,
    input: UpdateDirectionInput
  ): Promise<DirectionNoteWithReferences> => {
    const updated = await directionService.updateDirectionNote(id, input);
    await fetchDirectionNotes();
    return updated;
  };

  const duplicateDirectionNote = async (
    id: string
  ): Promise<DirectionNoteWithReferences> => {
    const duplicated = await directionService.duplicateDirectionNote(id);
    await fetchDirectionNotes();
    return duplicated;
  };

  const reorderDirectionNote = async (
    id: string,
    direction: 'up' | 'down'
  ): Promise<void> => {
    await directionService.reorderDirectionNote(id, direction);
    await fetchDirectionNotes();
  };

  const deleteDirectionNote = async (id: string): Promise<void> => {
    await directionService.deleteDirectionNote(id);
    setDirectionNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const linkReference = async (
    directionNoteId: string,
    referenceId: string
  ): Promise<void> => {
    await directionService.linkReference(directionNoteId, referenceId);
    await fetchDirectionNotes();
  };

  const unlinkReference = async (
    directionNoteId: string,
    referenceId: string
  ): Promise<void> => {
    await directionService.unlinkReference(directionNoteId, referenceId);
    setDirectionNotes((prev) =>
      prev.map((note) => {
        if (note.id !== directionNoteId) return note;
        return {
          ...note,
          references: note.references.filter((r) => r.id !== referenceId),
        };
      })
    );
  };

  return {
    directionNotes,
    isLoading,
    error,
    refetch: fetchDirectionNotes,
    createDirectionNote,
    updateDirectionNote,
    duplicateDirectionNote,
    reorderDirectionNote,
    deleteDirectionNote,
    linkReference,
    unlinkReference,
  };
}
