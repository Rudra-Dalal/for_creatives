'use client';

import { useState, useEffect, useCallback } from 'react';
import { directionService } from '../services/directionService';
import type { DirectionNote } from '../types';

export function useReferenceDirections(referenceId: string | null) {
  const [linkedDirections, setLinkedDirections] = useState<DirectionNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinkedDirections = useCallback(async () => {
    if (!referenceId) {
      setLinkedDirections([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await directionService.getDirectionNotesForReference(referenceId);
      setLinkedDirections(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch linked direction notes');
      }
    } finally {
      setIsLoading(false);
    }
  }, [referenceId]);

  useEffect(() => {
    fetchLinkedDirections();
  }, [fetchLinkedDirections]);

  const linkToDirection = async (directionNoteId: string): Promise<void> => {
    if (!referenceId) return;
    await directionService.linkReference(directionNoteId, referenceId);
    await fetchLinkedDirections();
  };

  const unlinkFromDirection = async (directionNoteId: string): Promise<void> => {
    if (!referenceId) return;
    await directionService.unlinkReference(directionNoteId, referenceId);
    setLinkedDirections((prev) => prev.filter((d) => d.id !== directionNoteId));
  };

  return {
    linkedDirections,
    isLoading,
    error,
    refetch: fetchLinkedDirections,
    linkToDirection,
    unlinkFromDirection,
  };
}
