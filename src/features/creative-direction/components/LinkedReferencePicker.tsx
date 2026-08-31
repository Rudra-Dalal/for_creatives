'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { referenceService } from '@/features/references/services/referenceService';
import type { Reference } from '@/features/references/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Search, Check, Globe, X } from 'lucide-react';
import Image from 'next/image';

interface LinkedReferencePickerProps {
  projectId: string;
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
}

export function LinkedReferencePicker({
  projectId,
  selectedIds,
  onChange,
}: LinkedReferencePickerProps) {
  const [references, setReferences] = useState<Reference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
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
  }, [projectId]);

  const filteredReferences = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return references;
    return references.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.source_domain?.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [references, search]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Connected References ({selectedIds.length} selected)
        </label>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
        <Input
          type="text"
          placeholder="Filter available references..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-8 h-8 text-xs bg-surface-subtle"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Reference Selection List */}
      <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-surface-subtle p-2 space-y-1.5">
        {isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <LoadingSpinner size="sm" label="Loading project references..." />
          </div>
        ) : references.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground/70">
            No references found in this project. Save references first to connect them.
          </div>
        ) : filteredReferences.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground/70">
            No references match &quot;{search}&quot;.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredReferences.map((ref) => {
              const isSelected = selectedIds.includes(ref.id);
              return (
                <div
                  key={ref.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSelect(ref.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSelect(ref.id);
                    }
                  }}
                  className={`flex items-center gap-2.5 p-2 rounded-md border text-left cursor-pointer transition-all select-none ${
                    isSelected
                      ? 'bg-accent/15 border-accent/60 text-foreground'
                      : 'bg-surface border-border-subtle hover:border-border hover:bg-surface-hover text-muted-foreground'
                  }`}
                >
                  {/* Thumbnail / Fallback */}
                  <div className="relative h-10 w-10 shrink-0 rounded overflow-hidden bg-surface border border-border-subtle flex items-center justify-center">
                    {ref.thumbnail_url ? (
                      <Image
                        src={ref.thumbnail_url}
                        alt={ref.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Title & Domain */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {ref.title}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground/70 block truncate">
                      {ref.source_domain || 'Reference'}
                    </span>
                  </div>

                  {/* Checkbox indicator */}
                  <div
                    className={`h-4 w-4 rounded shrink-0 flex items-center justify-center border transition-colors ${
                      isSelected
                        ? 'bg-accent border-accent text-accent-foreground'
                        : 'border-border bg-surface'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected tags summary if any */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {references
            .filter((r) => selectedIds.includes(r.id))
            .map((r) => (
              <Badge
                key={r.id}
                variant="accent"
                className="gap-1 text-[11px] pr-1 py-0.5"
              >
                <span className="max-w-[120px] truncate">{r.title}</span>
                <button
                  type="button"
                  onClick={() => toggleSelect(r.id)}
                  className="rounded-full hover:text-foreground text-accent"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
        </div>
      )}
    </div>
  );
}
