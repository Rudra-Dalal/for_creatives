'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { referenceService } from '../services/referenceService';
import type { Reference } from '../types';
import type { CreateReferenceInput, UpdateReferenceInput } from '../validation/referenceSchema';

export function useReferences(projectId: string) {
  const [references, setReferences] = useState<Reference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const fetchReferences = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await referenceService.getReferencesByProjectId(projectId);
      setReferences(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch references');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  // Derived list of all unique tags in this project
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const ref of references) {
      if (Array.isArray(ref.tags)) {
        for (const tag of ref.tags) {
          if (tag) tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [references]);

  // Filtered references
  const filteredReferences = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return references.filter((ref) => {
      // Tag filter
      if (selectedTag && (!ref.tags || !ref.tags.includes(selectedTag))) {
        return false;
      }
      // Search query filter
      if (q) {
        const matchesTitle = ref.title?.toLowerCase().includes(q);
        const matchesUrl = ref.url?.toLowerCase().includes(q);
        const matchesDomain = ref.source_domain?.toLowerCase().includes(q);
        const matchesNote = ref.note?.toLowerCase().includes(q);
        const matchesTag = ref.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesUrl && !matchesDomain && !matchesNote && !matchesTag) {
          return false;
        }
      }
      return true;
    });
  }, [references, searchQuery, selectedTag]);

  const createReference = async (input: CreateReferenceInput): Promise<Reference> => {
    const newRef = await referenceService.createReference({
      projectId: input.projectId,
      url: input.url,
      title: input.title,
      thumbnailUrl: input.thumbnailUrl,
      sourceDomain: input.sourceDomain,
      note: input.note,
      tags: input.tags,
    });
    setReferences((prev) => [newRef, ...prev]);
    return newRef;
  };

  const updateReference = async (
    id: string,
    input: UpdateReferenceInput
  ): Promise<Reference> => {
    const updated = await referenceService.updateReference(id, input);
    setReferences((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  };

  const deleteReference = async (id: string): Promise<void> => {
    await referenceService.deleteReference(id);
    setReferences((prev) => prev.filter((r) => r.id !== id));
  };

  // Bulk tag add
  const bulkAddTag = async (ids: string[], rawTag: string): Promise<void> => {
    const tag = rawTag.trim().replace(/^#/, '');
    if (!tag) return;

    const promises = ids.map(async (id) => {
      const ref = references.find((r) => r.id === id);
      if (!ref) return;
      const existingTags = ref.tags || [];
      if (!existingTags.includes(tag)) {
        const newTags = [...existingTags, tag];
        await referenceService.updateReference(id, { tags: newTags });
      }
    });

    await Promise.all(promises);
    await fetchReferences();
  };

  // Bulk tag remove
  const bulkRemoveTag = async (ids: string[], rawTag: string): Promise<void> => {
    const tag = rawTag.trim().replace(/^#/, '');
    if (!tag) return;

    const promises = ids.map(async (id) => {
      const ref = references.find((r) => r.id === id);
      if (!ref) return;
      const existingTags = ref.tags || [];
      if (existingTags.includes(tag)) {
        const newTags = existingTags.filter((t) => t !== tag);
        await referenceService.updateReference(id, { tags: newTags });
      }
    });

    await Promise.all(promises);
    await fetchReferences();
  };

  // Bulk soft-delete
  const bulkDelete = async (ids: string[]): Promise<void> => {
    const promises = ids.map((id) => referenceService.softDeleteReference(id));
    await Promise.all(promises);
    setReferences((prev) => prev.filter((r) => !ids.includes(r.id)));
  };

  return {
    references,
    filteredReferences,
    allTags,
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    isLoading,
    error,
    refetch: fetchReferences,
    createReference,
    updateReference,
    deleteReference,
    bulkAddTag,
    bulkRemoveTag,
    bulkDelete,
  };
}
