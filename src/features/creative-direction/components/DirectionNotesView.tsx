'use client';

import React, { useState } from 'react';
import { useDirectionNotes } from '../hooks/useDirectionNotes';
import { DirectionNoteCard } from './DirectionNoteCard';
import { CreateDirectionDialog } from './CreateDirectionDialog';
import { EditDirectionModal } from './EditDirectionModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DirectionNoteWithReferences } from '../types';
import { Plus, Compass, RefreshCw } from 'lucide-react';

interface DirectionNotesViewProps {
  projectId: string;
}

export function DirectionNotesView({ projectId }: DirectionNotesViewProps) {
  const {
    directionNotes,
    isLoading,
    error,
    refetch,
    createDirectionNote,
    updateDirectionNote,
    deleteDirectionNote,
    unlinkReference,
  } = useDirectionNotes(projectId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DirectionNoteWithReferences | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<DirectionNoteWithReferences | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <div className="flex-1 flex flex-col min-h-full px-6 py-6 max-w-5xl w-full mx-auto">
      {/* Header & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">
            Creative Direction
          </h2>
          {!isLoading && !error && (
            <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
              {directionNotes.length} {directionNotes.length === 1 ? 'statement' : 'statements'}
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5 shrink-0 text-xs font-medium self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Creative Direction</span>
        </Button>
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
              <Button
                onClick={() => setIsCreateOpen(true)}
                size="sm"
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Formulate First Direction</span>
              </Button>
            }
            className="py-24"
          />
        )}

        {/* Direction Notes Stream */}
        {!isLoading && !error && directionNotes.length > 0 && (
          <div className="space-y-6">
            {directionNotes.map((note) => (
              <DirectionNoteCard
                key={note.id}
                note={note}
                onEdit={(n) => setEditingNote(n)}
                onDeleteRequest={(n) => setNoteToDelete(n)}
                onUnlinkReference={unlinkReference}
                onOpenReferencePicker={(n) => setEditingNote(n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Direction Modal */}
      <CreateDirectionDialog
        projectId={projectId}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={createDirectionNote}
      />

      {/* Edit Direction Modal */}
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

      {/* Delete Direction Confirmation */}
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
    </div>
  );
}
