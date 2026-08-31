'use client';

import { useState, useEffect, useCallback } from 'react';
import { directionService } from '../services/directionService';
import type { DirectionNoteWithReferences } from '../types';
import type { CreateDirectionInput, UpdateDirectionInput } from '../validation/directionSchema';

export function useDirectionNotes(projectId: string) {
  const [directionNotes, setDirectionNotes] = useState<DirectionNoteWithReferences[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectionNotes = useCallback(async () => {
    if (!projectId) return;
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
  }, [projectId]);

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
      referenceIds: input.referenceIds,
    });
    setDirectionNotes((prev) => [created, ...prev]);
    return created;
  };

  const updateDirectionNote = async (
    id: string,
    input: UpdateDirectionInput
  ): Promise<DirectionNoteWithReferences> => {
    const updated = await directionService.updateDirectionNote(id, input);
    setDirectionNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    return updated;
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
    // Refresh to get full updated reference object in direction state
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
    deleteDirectionNote,
    linkReference,
    unlinkReference,
  };
}
