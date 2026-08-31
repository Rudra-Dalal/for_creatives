'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LinkedReferencePicker } from './LinkedReferencePicker';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { updateDirectionSchema, type UpdateDirectionInput } from '../validation/directionSchema';
import type { DirectionNoteWithReferences } from '../types';
import { Loader2, AlertCircle, Trash2, Save } from 'lucide-react';

interface EditDirectionModalProps {
  projectId: string;
  note: DirectionNoteWithReferences | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (
    id: string,
    input: UpdateDirectionInput
  ) => Promise<DirectionNoteWithReferences>;
  onDelete: (id: string) => Promise<void>;
}

export function EditDirectionModal({
  projectId,
  note,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: EditDirectionModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setDescription(note.description || '');
      setSelectedReferenceIds(note.references.map((r) => r.id));
      setError(null);
    }
  }, [note]);

  if (!note) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: UpdateDirectionInput = {
      title: title.trim(),
      description: description.trim(),
      referenceIds: selectedReferenceIds,
    };

    const validation = updateDirectionSchema.safeParse(payload);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Invalid details');
      return;
    }

    setIsLoading(true);
    try {
      await onUpdate(note.id, validation.data);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update direction note');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(note.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete direction note');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="font-display text-xl tracking-tight">
                Edit Creative Direction
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Update the direction statement, thesis, or connected reference evidence.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/30 text-red-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label htmlFor="edit-direction-title" className="text-xs font-medium text-muted-foreground">
                  Statement / Title
                </label>
                <Input
                  id="edit-direction-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isLoading}
                  required
                  className="font-display text-sm font-medium"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label htmlFor="edit-direction-desc" className="text-xs font-medium text-muted-foreground">
                  Creative Intent & Rationale
                </label>
                <Textarea
                  id="edit-direction-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              {/* Reference Picker */}
              <LinkedReferencePicker
                projectId={projectId}
                selectedIds={selectedReferenceIds}
                onChange={setSelectedReferenceIds}
              />
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border-subtle">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading || isDeleting}
                className="text-red-400 hover:text-red-300 hover:bg-danger/10 gap-1.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !title.trim()}
                  className="gap-1.5"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Direction</span>
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Creative Direction"
        description={`Are you sure you want to delete "${note.title}"? References linked to this statement will remain intact in your reference library.`}
        confirmLabel="Delete Statement"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
