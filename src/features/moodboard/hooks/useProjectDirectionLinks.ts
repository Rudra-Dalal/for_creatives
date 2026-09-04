'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { directionService } from '@/features/creative-direction/services/directionService';
import { createDirectionSchema } from '@/features/creative-direction/validation/directionSchema';
import type { DirectionNoteWithReferences } from '@/features/creative-direction/types';

export function useProjectDirectionLinks(projectId: string, readOnly?: boolean) {
  const [directionNotes, setDirectionNotes] = useState<DirectionNoteWithReferences[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectionNotes = useCallback(async () => {
    if (!projectId) return;
    try {
      setError(null);
      const notes = await directionService.getDirectionNotes(projectId);
      setDirectionNotes(notes);
    } catch (err: unknown) {
      console.error('Failed to fetch project direction notes for moodboard:', err);
      const msg = err instanceof Error ? err.message : 'Failed to fetch direction notes';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDirectionNotes();
  }, [fetchDirectionNotes]);

  // Map of referenceId -> count of linked direction notes
  const referenceCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of directionNotes) {
      if (Array.isArray(note.references)) {
        for (const ref of note.references) {
          if (ref?.id) {
            map.set(ref.id, (map.get(ref.id) || 0) + 1);
          }
        }
      }
    }
    return map;
  }, [directionNotes]);

  /**
   * Promotes a canvas idea item to a formal Creative Direction note,
   * reusing the exact same createDirectionSchema validation.
   */
  const promoteIdeaToDirection = useCallback(
    async (
      title: string,
      notes?: string,
      connectedReferenceIds: string[] = []
    ): Promise<DirectionNoteWithReferences> => {
      if (readOnly) {
        throw new Error('Cannot create direction note in read-only mode');
      }

      const payload = {
        projectId,
        title: title.trim(),
        description: (notes || '').trim(),
        referenceIds: connectedReferenceIds,
      };

      const validation = createDirectionSchema.safeParse(payload);
      if (!validation.success) {
        const errorMsg = validation.error.errors[0]?.message || 'Invalid direction statement details';
        throw new Error(errorMsg);
      }

      const created = await directionService.createDirectionNote(validation.data);
      await fetchDirectionNotes();
      return created;
    },
    [projectId, readOnly, fetchDirectionNotes]
  );

  return {
    directionNotes,
    referenceCounts,
    isLoading,
    error,
    refetch: fetchDirectionNotes,
    promoteIdeaToDirection,
  };
}
