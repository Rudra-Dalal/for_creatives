'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Plus, Trash2, X } from 'lucide-react';

interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'remove';
  selectedCount: number;
  availableTags: string[];
  onSubmit: (tag: string) => Promise<void>;
}

export function BulkTagModal({
  isOpen,
  onClose,
  mode,
  selectedCount,
  availableTags,
  onSubmit,
}: BulkTagModalProps) {
  const [tagInput, setTagInput] = useState('');
  const [selectedExistingTag, setSelectedExistingTag] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTag = mode === 'add' ? tagInput.trim() : selectedExistingTag;
    if (!targetTag) return;

    setIsSubmitting(true);
    try {
      await onSubmit(targetTag);
      setTagInput('');
      setSelectedExistingTag(null);
      onClose();
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 gap-4 border-border bg-surface shadow-floating">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-accent" />
            <DialogTitle className="text-base font-medium">
              {mode === 'add' ? 'Add Tag to References' : 'Remove Tag from References'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Apply changes to {selectedCount} selected reference{selectedCount === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'add' ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Tag Name</label>
              <Input
                autoFocus
                placeholder="e.g. typography, brutalism, layout"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="text-xs"
              />

              {availableTags.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] text-muted-foreground">Or choose existing:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-24 overflow-y-auto">
                    {availableTags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTagInput(t)}
                        className={`rounded px-2 py-0.5 text-[11px] border transition-colors ${
                          tagInput === t
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface-subtle border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Select Tag to Remove</label>
              {availableTags.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No tags found on selected items.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {availableTags.map((t) => {
                    const isSelected = selectedExistingTag === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedExistingTag(isSelected ? null : t)}
                        className={`rounded px-2.5 py-1 text-xs border transition-colors flex items-center gap-1 ${
                          isSelected
                            ? 'bg-danger text-white border-danger'
                            : 'bg-surface-subtle border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>#{t}</span>
                        {isSelected && <X className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={mode === 'add' ? 'default' : 'danger'}
              disabled={isSubmitting || (mode === 'add' ? !tagInput.trim() : !selectedExistingTag)}
            >
              {mode === 'add' ? 'Add Tag' : 'Remove Tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
