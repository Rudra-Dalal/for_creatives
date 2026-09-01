'use client';

import React, { useState, useMemo } from 'react';
import { useReferences } from '../hooks/useReferences';
import { ReferenceCard } from './ReferenceCard';
import { ReferenceDetailPanel } from './ReferenceDetailPanel';
import { AddReferenceDialog } from './AddReferenceDialog';
import { BulkTagModal } from './BulkTagModal';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Reference } from '../types';
import {
  Plus,
  Search,
  X,
  Bookmark,
  RefreshCw,
  SlidersHorizontal,
  Tag,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';

interface ReferenceLibraryProps {
  projectId: string;
}

export function ReferenceLibrary({ projectId }: ReferenceLibraryProps) {
  const {
    references,
    filteredReferences,
    allTags,
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    isLoading,
    error,
    refetch,
    createReference,
    updateReference,
    deleteReference,
    bulkAddTag,
    bulkRemoveTag,
    bulkDelete,
  } = useReferences(projectId);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
  const [bulkTagMode, setBulkTagMode] = useState<'add' | 'remove'>('add');
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Tags available on currently selected references
  const selectedItemsTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const id of selectedIds) {
      const ref = references.find((r) => r.id === id);
      if (ref?.tags) {
        for (const t of ref.tags) {
          if (t) tagSet.add(t);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [selectedIds, references]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredReferences.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReferences.map((r) => r.id));
    }
  };

  const handleBulkAddTag = async (tag: string) => {
    await bulkAddTag(selectedIds, tag);
    setSelectedIds([]);
  };

  const handleBulkRemoveTag = async (tag: string) => {
    await bulkRemoveTag(selectedIds, tag);
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Move ${selectedIds.length} selected references to Trash?`)) return;
    setIsDeletingBulk(true);
    try {
      await bulkDelete(selectedIds);
      setSelectedIds([]);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Keep selected reference in sync with local updates
  const activeSelected = selectedReference
    ? references.find((r) => r.id === selectedReference.id) || null
    : null;

  return (
    <div className="relative flex-1 flex flex-col min-h-full px-6 py-6 max-w-7xl w-full mx-auto">
      {/* Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
            References
          </h2>
          {!isLoading && !error && (
            <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
              {references.length} {references.length === 1 ? 'item' : 'items'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder="Search references..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Primary Action Button */}
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5 shrink-0 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Paste a link</span>
          </Button>
        </div>
      </div>

      {/* Tags Filter Ribbon & Select All Toggle */}
      {!isLoading && !error && references.length > 0 && (
        <div className="flex items-center justify-between py-3 border-b border-border-subtle gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground/80 shrink-0 mr-1 font-mono">
              <SlidersHorizontal className="h-3 w-3" />
              <span>Filter:</span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors shrink-0 font-medium ${
                selectedTag === null
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground border border-border-subtle'
              }`}
            >
              All ({references.length})
            </button>

            {allTags.map((tag) => {
              const isSelected = selectedTag === tag;
              const count = references.filter((r) => r.tags?.includes(tag)).length;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-accent text-accent-foreground font-medium shadow-sm'
                      : 'bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground border border-border-subtle'
                  }`}
                >
                  #{tag} <span className="opacity-60 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Select All Quick Button */}
          {filteredReferences.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0 pl-3 border-l border-border transition-colors"
            >
              {selectedIds.length === filteredReferences.length ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5 text-accent" />
                  <span>Deselect all</span>
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5" />
                  <span>Select all</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Main Grid / State Container */}
      <div className="flex-1 pt-6 pb-20">
        {/* Loading State */}
        {isLoading && (
          <div className="py-24 flex items-center justify-center">
            <LoadingSpinner label="Loading references..." />
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="py-16 text-center">
            <p className="text-xs text-red-400 mb-3">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Try Again</span>
            </Button>
          </div>
        )}

        {/* Project Empty State */}
        {!isLoading && !error && references.length === 0 && (
          <EmptyState
            icon={<Bookmark className="h-10 w-10 stroke-[1.25]" />}
            title="Start collecting visual references."
            description="Paste links from Pinterest, Cosmos, Behance, Arena, Instagram, or any website to build your visual library."
            action={
              <Button
                onClick={() => setIsAddOpen(true)}
                size="sm"
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Paste First Link</span>
              </Button>
            }
            className="py-20"
          />
        )}

        {/* Filtered No Matches State */}
        {!isLoading && !error && references.length > 0 && filteredReferences.length === 0 && (
          <EmptyState
            title="No matching references"
            description="No references match your current search query or tag filter."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag(null);
                }}
              >
                Clear Filters
              </Button>
            }
            className="py-16"
          />
        )}

        {/* References Grid */}
        {!isLoading && !error && filteredReferences.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredReferences.map((ref) => {
              const isChecked = selectedIds.includes(ref.id);
              return (
                <ReferenceCard
                  key={ref.id}
                  reference={ref}
                  isSelected={activeSelected?.id === ref.id}
                  isChecked={isChecked}
                  isMultiSelectMode={selectedIds.length > 0}
                  onToggleCheck={() => toggleSelect(ref.id)}
                  onClick={() => {
                    if (selectedIds.length > 0) {
                      toggleSelect(ref.id);
                    } else {
                      setSelectedReference(ref);
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Multi-Select Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-border bg-surface/95 backdrop-blur-md px-4 py-2 shadow-floating animate-in fade-in-50 slide-in-from-bottom-2">
          <span className="text-xs font-medium text-foreground pr-2 border-r border-border">
            {selectedIds.length} selected
          </span>

          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1 px-2.5 rounded-full"
            onClick={() => {
              setBulkTagMode('add');
              setBulkTagModalOpen(true);
            }}
          >
            <Tag className="h-3 w-3 text-accent" />
            <span>Add Tag</span>
          </Button>

          {selectedItemsTags.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs gap-1 px-2.5 rounded-full"
              onClick={() => {
                setBulkTagMode('remove');
                setBulkTagModalOpen(true);
              }}
            >
              <X className="h-3 w-3 text-muted-foreground" />
              <span>Remove Tag</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="danger"
            className="h-7 text-xs gap-1 px-2.5 rounded-full"
            disabled={isDeletingBulk}
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-3 w-3" />
            <span>Delete</span>
          </Button>

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-hover ml-1"
            title="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bulk Tag Modal */}
      <BulkTagModal
        isOpen={bulkTagModalOpen}
        onClose={() => setBulkTagModalOpen(false)}
        mode={bulkTagMode}
        selectedCount={selectedIds.length}
        availableTags={bulkTagMode === 'add' ? allTags : selectedItemsTags}
        onSubmit={bulkTagMode === 'add' ? handleBulkAddTag : handleBulkRemoveTag}
      />

      {/* Capture Reference Dialog */}
      <AddReferenceDialog
        projectId={projectId}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSubmit={createReference}
        onReferenceCreated={(created) => {
          setSelectedReference(created);
        }}
      />

      {/* Reference Detail Slide Drawer */}
      <ReferenceDetailPanel
        reference={activeSelected}
        projectId={projectId}
        onClose={() => setSelectedReference(null)}
        onUpdate={updateReference}
        onDelete={deleteReference}
      />
    </div>
  );
}
