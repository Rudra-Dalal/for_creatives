'use client';

import React, { useState, useMemo } from 'react';
import { useDirectionNotes } from '../hooks/useDirectionNotes';
import { DirectionNoteCard } from './DirectionNoteCard';
import { CreateDirectionDialog } from './CreateDirectionDialog';
import { EditDirectionModal } from './EditDirectionModal';
import { DirectionExportPdfModal } from './DirectionExportPdfModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { DIRECTION_CATEGORIES, type DirectionCategory, type DirectionNoteWithReferences } from '../types';
import { Plus, Compass, RefreshCw, FileText } from 'lucide-react';

interface DirectionNotesViewProps {
  projectId: string;
  projectName?: string;
  readOnly?: boolean;
  initialNotes?: DirectionNoteWithReferences[];
}

export function DirectionNotesView({
  projectId,
  projectName = 'Creative Direction',
  readOnly = false,
  initialNotes,
}: DirectionNotesViewProps) {
  const {
    directionNotes,
    isLoading,
    error,
    refetch,
    createDirectionNote,
    updateDirectionNote,
    duplicateDirectionNote,
    reorderDirectionNote,
    deleteDirectionNote,
    unlinkReference,
  } = useDirectionNotes(projectId, initialNotes, readOnly);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DirectionNoteWithReferences | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<DirectionNoteWithReferences | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recentlyDuplicatedId, setRecentlyDuplicatedId] = useState<string | null>(null);

  const handleDuplicate = async (note: DirectionNoteWithReferences) => {
    try {
      const created = await duplicateDirectionNote(note.id);
      setRecentlyDuplicatedId(created.id);
      setTimeout(() => {
        setRecentlyDuplicatedId(null);
      }, 2000);
    } catch {
      // Error handled in service
    }
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDirectionNote(noteToDelete.id);
      setNoteToDelete(null);
    } catch {
      // Error handled in service/hook
    } finally {
      setIsDeleting(false);
    }
  };

  const hasAnyCategorized = useMemo(() => {
    return directionNotes.some((n) => !!n.category);
  }, [directionNotes]);

  const categoryGroups = useMemo(() => {
    if (!hasAnyCategorized) return [];

    const orderKeys: (DirectionCategory | 'uncategorized')[] = [
      ...DIRECTION_CATEGORIES,
      'uncategorized',
    ];

    const map = new Map<string, DirectionNoteWithReferences[]>();
    for (const key of orderKeys) {
      map.set(key, []);
    }

    for (const note of directionNotes) {
      const key = note.category || 'uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(note);
    }

    return orderKeys
      .map((key) => ({
        key,
        label: key === 'uncategorized' ? '—' : key,
        notes: map.get(key) || [],
      }))
      .filter((group) => group.notes.length > 0);
  }, [directionNotes, hasAnyCategorized]);

  return (
    <div className="flex-1 flex flex-col min-h-full px-6 py-6 max-w-5xl w-full mx-auto">
      {/* Header & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
            Creative Direction
          </h2>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {directionNotes.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsExportPdfOpen(true)}
              className="gap-1.5 shrink-0 text-xs font-medium"
            >
              <FileText className="h-3.5 w-3.5 text-accent" />
              <span>Export PDF</span>
            </Button>
          )}

          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 shrink-0 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Statement</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pt-6">
        {/* Loading State */}
        {isLoading && (
          <div className="py-24 flex items-center justify-center">
            <LoadingSpinner label="Loading creative direction..." />
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

        {/* Empty State */}
        {!isLoading && !error && directionNotes.length === 0 && (
          <EmptyState
            icon={<Compass className="h-10 w-10 stroke-[1.25]" />}
            title="Your visual thinking starts here."
            description="Formulate aesthetic principles, mood theses, or creative decisions, and connect the references that justify them."
            action={
              !readOnly ? (
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Formulate First Direction</span>
                </Button>
              ) : undefined
            }
            className="py-24"
          />
        )}

        {/* Categorized Groups View */}
        {!isLoading && !error && directionNotes.length > 0 && hasAnyCategorized && (
          <div className="space-y-12">
            {categoryGroups.map((group) => (
              <section key={group.key} className="space-y-4">
                {/* Section Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                    {group.label}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {group.notes.length}
                  </span>
                </div>

                {/* Section Cards */}
                <div className="space-y-6">
                  {group.notes.map((note, idx) => (
                    <DirectionNoteCard
                      key={note.id}
                      note={note}
                      readOnly={readOnly}
                      isFirst={idx === 0}
                      isLast={idx === group.notes.length - 1}
                      isJustDuplicated={note.id === recentlyDuplicatedId}
                      onEdit={(n) => setEditingNote(n)}
                      onDeleteRequest={(n) => setNoteToDelete(n)}
                      onDuplicate={handleDuplicate}
                      onReorder={(n, dir) => reorderDirectionNote(n.id, dir)}
                      onUnlinkReference={unlinkReference}
                      onOpenReferencePicker={(n) => setEditingNote(n)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Flat View (when no note has a category assigned) */}
        {!isLoading && !error && directionNotes.length > 0 && !hasAnyCategorized && (
          <div className="space-y-6">
            {directionNotes.map((note, idx) => (
              <DirectionNoteCard
                key={note.id}
                note={note}
                readOnly={readOnly}
                isFirst={idx === 0}
                isLast={idx === directionNotes.length - 1}
                isJustDuplicated={note.id === recentlyDuplicatedId}
                onEdit={(n) => setEditingNote(n)}
                onDeleteRequest={(n) => setNoteToDelete(n)}
                onDuplicate={handleDuplicate}
                onReorder={(n, dir) => reorderDirectionNote(n.id, dir)}
                onUnlinkReference={unlinkReference}
                onOpenReferencePicker={(n) => setEditingNote(n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Direction Modal */}
      {!readOnly && (
        <CreateDirectionDialog
          projectId={projectId}
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSubmit={createDirectionNote}
        />
      )}

      {/* Edit Direction Modal */}
      {!readOnly && (
        <EditDirectionModal
          projectId={projectId}
          note={editingNote}
          open={!!editingNote}
          onOpenChange={(open) => {
            if (!open) setEditingNote(null);
          }}
          onUpdate={updateDirectionNote}
          onDelete={async (id) => {
            await deleteDirectionNote(id);
            setEditingNote(null);
          }}
        />
      )}

      {/* Export Direction PDF Modal */}
      <DirectionExportPdfModal
        isOpen={isExportPdfOpen}
        onClose={() => setIsExportPdfOpen(false)}
        projectName={projectName}
        directionNotes={directionNotes}
      />

      {/* Delete Direction Confirmation */}
      {!readOnly && (
        <ConfirmDialog
          open={!!noteToDelete}
          onOpenChange={(open) => {
            if (!open) setNoteToDelete(null);
          }}
          title="Delete Creative Direction"
          description={`Are you sure you want to delete "${noteToDelete?.title}"? All references connected to this statement will remain intact in your reference library.`}
          confirmLabel="Delete Direction"
          variant="danger"
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
