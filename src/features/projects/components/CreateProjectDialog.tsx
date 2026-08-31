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
import { createProjectSchema, type CreateProjectInput } from '../validation/projectSchema';
import type { Project } from '../types';
import { Loader2, AlertCircle } from 'lucide-react';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (project: Project) => void;
  onSubmit: (input: CreateProjectInput) => Promise<Project>;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
  onSubmit,
}: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = createProjectSchema.safeParse({ name, description });
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Invalid project details');
      return;
    }

    setIsLoading(true);
    try {
      const project = await onSubmit(validation.data);
      setName('');
      setDescription('');
      onOpenChange(false);
      if (onProjectCreated) {
        onProjectCreated(project);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create project');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight">New Project</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a dedicated workspace for references, moodboard & creative direction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/30 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="project-name" className="text-xs font-medium text-muted-foreground">
                Project Name
              </label>
              <Input
                id="project-name"
                placeholder="e.g. Brand Identity, Editorial 2026, Architectural Study"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-desc" className="text-xs font-medium text-muted-foreground">
                Description <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Textarea
                id="project-desc"
                placeholder="Brief summary of the creative brief, goals, or aesthetic focus"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Create Workspace'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
