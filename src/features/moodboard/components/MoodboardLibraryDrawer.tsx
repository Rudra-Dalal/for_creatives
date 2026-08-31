'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { referenceService } from '@/features/references/services/referenceService';
import type { Reference } from '@/features/references/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  X,
  Search,
  Plus,
  GripHorizontal,
  Globe,
  FolderOpen,
} from 'lucide-react';
import Image from 'next/image';

interface MoodboardLibraryDrawerProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onPlaceReference: (reference: Reference) => void;
}

export function MoodboardLibraryDrawer({
  projectId,
  isOpen,
  onClose,
  onPlaceReference,
}: MoodboardLibraryDrawerProps) {
  const [references, setReferences] = useState<Reference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoading(true);

    referenceService
      .getReferencesByProjectId(projectId)
      .then((data) => {
        if (isMounted) {
          setReferences(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, isOpen]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const ref of references) {
      if (Array.isArray(ref.tags)) {
        for (const t of ref.tags) {
          if (t.trim()) tagSet.add(t.trim());
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [references]);

  // Filter references
  const filteredReferences = useMemo(() => {
    const q = search.toLowerCase().trim();
    return references.filter((ref) => {
      const matchesSearch =
        !q ||
        ref.title?.toLowerCase().includes(q) ||
        ref.source_domain?.toLowerCase().includes(q) ||
        ref.tags?.some((t) => t.toLowerCase().includes(q));

      const matchesTag = !selectedTag || ref.tags?.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }, [references, search, selectedTag]);

  const handleDragStart = (e: React.DragEvent, ref: Reference) => {
    e.dataTransfer.setData('application/json', JSON.stringify(ref));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-none sm:hidden"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside
        className="absolute left-4 top-4 bottom-20 z-30 flex w-80 flex-col rounded-xl border border-border bg-surface/95 backdrop-blur-lg shadow-floating animate-in slide-in-from-left-4 duration-200"
        aria-label="Reference Library Drawer"
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-accent" />
            <span className="font-mono text-xs uppercase tracking-wider text-foreground">
              Reference Library
            </span>
            <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5">
              {references.length}
            </Badge>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
            title="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Controls */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder="Search references..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-surface-subtle"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                  selectedTag === null
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'bg-surface-subtle text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                    selectedTag === tag
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'bg-surface-subtle text-muted-foreground hover:text-foreground'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Reference List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="sm" label="Loading references..." />
            </div>
          ) : references.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground/70 px-4">
              No references saved yet. Capture references from the References tab first.
            </div>
          ) : filteredReferences.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground/70">
              No references match your filter.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase text-muted-foreground/60 px-1">
                Drag onto canvas or click to add
              </p>
              {filteredReferences.map((ref) => (
                <div
                  key={ref.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, ref)}
                  className="group relative flex items-center gap-2.5 rounded-lg border border-border bg-surface-subtle p-2 cursor-grab active:cursor-grabbing hover:border-border-strong hover:bg-surface transition-all"
                >
                  {/* Thumbnail */}
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-surface-hover/50 flex items-center justify-center">
                    {ref.thumbnail_url ? (
                      <Image
                        src={ref.thumbnail_url}
                        alt={ref.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Globe className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate" title={ref.title}>
                      {ref.title}
                    </p>
                    <span className="font-mono text-[10px] text-muted-foreground/70 block truncate">
                      {ref.source_domain}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPlaceReference(ref)}
                      className="flex h-7 items-center gap-1 rounded bg-surface border border-border px-2 text-[11px] font-medium text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                      title="Place on canvas center"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                    <div className="text-muted-foreground/40 cursor-grab">
                      <GripHorizontal className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
