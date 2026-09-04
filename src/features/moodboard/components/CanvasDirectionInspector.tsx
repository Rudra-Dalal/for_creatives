'use client';

import React, { useState, useMemo } from 'react';
import type { Reference } from '@/features/references/types';
import type { DirectionNoteWithReferences } from '@/features/creative-direction/types';
import { useReferenceDirections } from '@/features/creative-direction/hooks/useReferenceDirections';
import { directionService } from '@/features/creative-direction/services/directionService';
import { createDirectionSchema } from '@/features/creative-direction/validation/directionSchema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  Compass,
  X,
  Plus,
  Link2,
  Unlink2,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Globe,
  FileText,
} from 'lucide-react';
import Image from 'next/image';

interface CanvasDirectionInspectorProps {
  projectId: string;
  reference: Reference | null;
  isOpen: boolean;
  onClose: () => void;
  availableDirections: DirectionNoteWithReferences[];
  onDirectionsChanged?: () => void;
  onNavigateToDirection?: (directionNoteId: string) => void;
  readOnly?: boolean;
}

export function CanvasDirectionInspector({
  projectId,
  reference,
  isOpen,
  onClose,
  availableDirections,
  onDirectionsChanged,
  onNavigateToDirection,
  readOnly = false,
}: CanvasDirectionInspectorProps) {
  const referenceId = reference?.id || null;

  const {
    linkedDirections,
    isLoading,
    error: hookError,
    linkToDirection,
    unlinkFromDirection,
  } = useReferenceDirections(referenceId);

  // Draft new statement state
  const [isDraftingNew, setIsDraftingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Link existing statement state
  const [selectedExistingId, setSelectedExistingId] = useState<string>('');
  const [isLinkingExisting, setIsLinkingExisting] = useState(false);

  // Local action status / error feedback
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter project directions to find ones NOT currently linked to this reference
  const unlinkedDirections = useMemo(() => {
    const linkedSet = new Set(linkedDirections.map((d) => d.id));
    return availableDirections.filter((d) => !linkedSet.has(d.id));
  }, [availableDirections, linkedDirections]);

  if (!isOpen || !reference) return null;

  const handleLinkExisting = async () => {
    if (!selectedExistingId || !referenceId || readOnly) return;
    setActionError(null);
    setIsLinkingExisting(true);
    try {
      await linkToDirection(selectedExistingId);
      setSelectedExistingId('');
      setSuccessMessage('Linked statement successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      onDirectionsChanged?.();
    } catch (err: unknown) {
      console.error('Failed to link direction note:', err);
      const msg = err instanceof Error ? err.message : 'Failed to link direction note';
      setActionError(msg);
    } finally {
      setIsLinkingExisting(false);
    }
  };

  const handleUnlink = async (directionNoteId: string) => {
    if (!referenceId || readOnly) return;
    setActionError(null);
    try {
      await unlinkFromDirection(directionNoteId);
      setSuccessMessage('Unlinked statement');
      setTimeout(() => setSuccessMessage(null), 3000);
      onDirectionsChanged?.();
    } catch (err: unknown) {
      console.error('Failed to unlink direction note:', err);
      const msg = err instanceof Error ? err.message : 'Failed to unlink direction note';
      setActionError(msg);
    }
  };

  const handleCreateAndLinkNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !referenceId) return;

    setValidationError(null);
    setActionError(null);

    // Reuse the exact same createDirectionSchema validation
    const payload = {
      projectId,
      title: newTitle.trim(),
      description: newDescription.trim(),
      referenceIds: [referenceId],
    };

    const validation = createDirectionSchema.safeParse(payload);
    if (!validation.success) {
      setValidationError(validation.error.errors[0]?.message || 'Invalid direction statement details');
      return;
    }

    setIsSubmittingNew(true);
    try {
      await directionService.createDirectionNote(validation.data);
      setNewTitle('');
      setNewDescription('');
      setIsDraftingNew(false);
      setSuccessMessage('Direction statement created & linked');
      setTimeout(() => setSuccessMessage(null), 3500);
      onDirectionsChanged?.();
    } catch (err: unknown) {
      console.error('Failed to create and link direction note:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create direction note';
      setActionError(msg);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-none sm:hidden"
        onClick={onClose}
      />

      {/* Slide-out Inspector Drawer */}
      <aside
        className="absolute right-4 top-4 bottom-20 z-30 flex w-92 max-w-[calc(100vw-32px)] flex-col rounded-xl border border-border bg-surface shadow-floating animate-in slide-in-from-right-4 duration-200 overflow-hidden"
        aria-label="Creative Direction Inspector"
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border px-4 bg-surface-subtle">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-accent" />
            <span className="font-mono text-xs uppercase tracking-wider text-foreground">
              Direction Links
            </span>
            <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5">
              {linkedDirections.length}
            </Badge>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
            title="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Reference Preview Bar */}
        <div className="flex items-center gap-3 p-3 border-b border-border bg-surface/50">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded border border-border bg-surface-subtle">
            {reference.thumbnail_url ? (
              <Image
                src={reference.thumbnail_url}
                alt={reference.title || 'Reference'}
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <Globe className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-xs text-foreground truncate" title={reference.title}>
              {reference.title || 'Untitled Reference'}
            </h4>
            {reference.source_domain && (
              <span className="font-mono text-[10px] text-muted-foreground block truncate">
                {reference.source_domain}
              </span>
            )}
          </div>
        </div>

        {/* Feedback Banners */}
        {(actionError || hookError) && (
          <div className="p-2.5 mx-3 mt-3 rounded-lg border border-danger/40 bg-red-950/20 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-danger" />
            <span className="flex-1 leading-relaxed">{actionError || hookError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-2.5 mx-3 mt-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="flex-1 leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Main Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Linked Statements Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Influenced Statements ({linkedDirections.length})
              </span>
            </div>

            {isLoading ? (
              <div className="py-6 flex items-center justify-center">
                <LoadingSpinner label="Loading direction links..." />
              </div>
            ) : linkedDirections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 p-4 text-center space-y-1.5 bg-surface-subtle/40">
                <p className="text-xs text-muted-foreground">
                  This reference has not been linked to any creative direction notes yet.
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  Link an existing statement below or draft a new one to preserve the creative decision.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedDirections.map((dir) => (
                  <div
                    key={dir.id}
                    className="group rounded-lg border border-border bg-surface-subtle/80 p-3 hover:border-accent/40 transition-colors space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="font-display text-sm font-medium text-foreground leading-snug">
                        {dir.title}
                      </h5>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleUnlink(dir.id)}
                          className="text-muted-foreground/60 hover:text-red-400 p-1 rounded hover:bg-danger/10 transition-colors shrink-0 cursor-pointer"
                          title="Unlink from this reference"
                        >
                          <Unlink2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {dir.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {dir.description}
                      </p>
                    )}

                    {onNavigateToDirection && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => onNavigateToDirection(dir.id)}
                          className="text-[10px] text-accent hover:underline flex items-center gap-1 font-mono cursor-pointer"
                        >
                          <span>View in Creative Direction</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!readOnly && (
            <>
              {/* Link Existing Direction Note */}
              {unlinkedDirections.length > 0 && (
                <div className="pt-2 border-t border-border space-y-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
                    Link Existing Statement
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedExistingId}
                      onChange={(e) => setSelectedExistingId(e.target.value)}
                      className="flex-1 rounded-md bg-surface-subtle border border-border px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-accent"
                    >
                      <option value="">Select a statement...</option>
                      {unlinkedDirections.map((dir) => (
                        <option key={dir.id} value={dir.id}>
                          {dir.title}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleLinkExisting}
                      disabled={!selectedExistingId || isLinkingExisting}
                      className="h-8 px-3 text-xs shrink-0 gap-1.5"
                    >
                      {isLinkingExisting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Link2 className="h-3 w-3 text-accent" />
                      )}
                      <span>Link</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Draft New Statement Directly from Canvas */}
              <div className="pt-2 border-t border-border space-y-2.5">
                {!isDraftingNew ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsDraftingNew(true)}
                    className="w-full justify-center gap-1.5 text-xs text-accent hover:text-accent-hover hover:bg-accent/10 border border-dashed border-accent/30 py-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Direction Statement</span>
                  </Button>
                ) : (
                  <form
                    onSubmit={handleCreateAndLinkNew}
                    className="rounded-lg border border-accent/40 bg-surface-subtle p-3 space-y-2.5 animate-in fade-in-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-accent" />
                        <span>New Direction Statement</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDraftingNew(false);
                          setValidationError(null);
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>

                    {validationError && (
                      <div className="p-2 rounded bg-danger/10 border border-danger/30 text-red-400 text-[11px] leading-tight">
                        {validationError}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground uppercase">
                        Statement Title
                      </label>
                      <Input
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Editorial warmth and generous space"
                        className="h-8 text-xs bg-surface"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground uppercase">
                        Description / Justification
                      </label>
                      <Textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Explain how this reference justifies or guides the creative direction..."
                        className="min-h-[64px] text-xs bg-surface resize-none leading-relaxed"
                      />
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingNew || !newTitle.trim()}
                      className="w-full h-8 text-xs gap-1.5 bg-accent text-white hover:bg-accent-hover"
                    >
                      {isSubmittingNew ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Creating Statement...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>Create & Link Statement</span>
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
