'use client';

import React, { useState } from 'react';
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
import { createDirectionSchema, type CreateDirectionInput } from '../validation/directionSchema';
import type { DirectionNoteWithReferences } from '../types';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

interface CreateDirectionDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialReferenceId?: string;
  onDirectionCreated?: (created: DirectionNoteWithReferences) => void;
  onSubmit: (input: CreateDirectionInput) => Promise<DirectionNoteWithReferences>;
}

export function CreateDirectionDialog({
  projectId,
  open,
  onOpenChange,
  initialReferenceId,
  onDirectionCreated,
  onSubmit,
}: CreateDirectionDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>(
    initialReferenceId ? [initialReferenceId] : []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedReferenceIds(initialReferenceId ? [initialReferenceId] : []);
    setError(null);
    setIsLoading(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: CreateDirectionInput = {
      projectId,
      title: title.trim(),
      description: description.trim(),
      referenceIds: selectedReferenceIds,
    };

    const validation = createDirectionSchema.safeParse(payload);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Invalid direction note details');
      return;
    }

    setIsLoading(true);
    try {
      const created = await onSubmit(validation.data);
      handleOpenChange(false);
      if (onDirectionCreated) {
        onDirectionCreated(created);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create direction note');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <DialogTitle className="font-display text-xl tracking-tight">
                New Creative Direction
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Formulate an aesthetic statement, mood thesis, or creative principle supported by reference evidence.
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
              <label htmlFor="direction-title" className="text-xs font-medium text-muted-foreground">
                Statement / Direction Title <span className="text-red-400">*</span>
              </label>
              <Input
                id="direction-title"
                placeholder="e.g. Tactile Brutalism, Editorial Warmth, Restrained Typography"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                autoFocus
                required
                className="font-display text-sm font-medium"
              />
            </div>

            {/* Description / Thesis */}
            <div className="space-y-1.5">
              <label htmlFor="direction-desc" className="text-xs font-medium text-muted-foreground">
                Creative Intent & Rationale
              </label>
              <Textarea
                id="direction-desc"
                placeholder="Describe the aesthetic rules, material choices, lighting qualities, or design justifications..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            {/* Connected References Picker */}
            <LinkedReferencePicker
              projectId={projectId}
              selectedIds={selectedReferenceIds}
              onChange={setSelectedReferenceIds}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Save Creative Direction'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
