'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Reference } from '../types';
import type { UpdateReferenceInput } from '../validation/referenceSchema';
import { updateReferenceSchema } from '../validation/referenceSchema';
import { thumbnailService } from '../services/thumbnailService';
import { useReferenceDirections } from '@/features/creative-direction/hooks/useReferenceDirections';
import { directionService } from '@/features/creative-direction/services/directionService';
import { CreateDirectionDialog } from '@/features/creative-direction/components/CreateDirectionDialog';
import type { DirectionNoteWithReferences } from '@/features/creative-direction/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  X,
  ExternalLink,
  Upload,
  Trash2,
  Save,
  Loader2,
  Calendar,
  Compass,
  AlertCircle,
  CheckCircle2,
  Globe,
  Plus,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';

interface ReferenceDetailPanelProps {
  reference: Reference | null;
  projectId: string;
  onClose: () => void;
  onUpdate: (id: string, input: UpdateReferenceInput) => Promise<Reference>;
  onDelete: (id: string) => Promise<void>;
  onNavigateToDirection?: (directionNoteId: string) => void;
}

export function ReferenceDetailPanel({
  reference,
  projectId,
  onClose,
  onUpdate,
  onDelete,
}: ReferenceDetailPanelProps) {
  const [title, setTitle] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Creative direction linking state
  const {
    linkedDirections,
    isLoading: isLoadingDirections,
    linkToDirection,
    unlinkFromDirection,
    refetch: refetchDirections,
  } = useReferenceDirections(reference?.id || null);

  const [availableDirections, setAvailableDirections] = useState<DirectionNoteWithReferences[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const [isCreateDirectionOpen, setIsCreateDirectionOpen] = useState(false);
  const [selectedDirectionToLink, setSelectedDirectionToLink] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available directions for linking picker
  useEffect(() => {
    if (projectId) {
      directionService.getDirectionNotes(projectId).then(setAvailableDirections).catch(() => {});
    }
  }, [projectId, reference]);

  // Sync state with selected reference
  useEffect(() => {
    if (reference) {
      setTitle(reference.title || '');
      setThumbnailUrl(reference.thumbnail_url || '');
      setNote(reference.note || '');
      setTags(Array.isArray(reference.tags) ? [...reference.tags] : []);
      setTagInput('');
      setError(null);
      setSuccessMessage(null);
      setImageError(false);
      setSelectedDirectionToLink('');
    }
  }, [reference]);

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && reference && !showDeleteConfirm && !isCreateDirectionOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reference, showDeleteConfirm, isCreateDirectionOpen, onClose]);

  if (!reference) return null;

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(reference.created_at));

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^,|,$/g, '');
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const publicUrl = await thumbnailService.uploadThumbnail(projectId, file);
      setThumbnailUrl(publicUrl);
      setImageError(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to upload custom thumbnail');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const payload: UpdateReferenceInput = {
      title: title.trim(),
      thumbnailUrl: thumbnailUrl.trim(),
      note: note.trim(),
      tags,
    };

    const validation = updateReferenceSchema.safeParse(payload);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Invalid details');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(reference.id, validation.data);
      setSuccessMessage('Changes saved');
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save changes');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(reference.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete reference');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuickLinkDirection = async () => {
    if (!selectedDirectionToLink) return;
    setIsLinking(true);
    try {
      await linkToDirection(selectedDirectionToLink);
      setSelectedDirectionToLink('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsLinking(false);
    }
  };

  const unlinkedAvailableDirections = availableDirections.filter(
    (d) => !linkedDirections.some((ld) => ld.id === d.id)
  );

  const hasThumbnail = thumbnailUrl && !imageError;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-none sm:hidden"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-floating transition-transform duration-300 ease-in-out sm:w-[440px]"
        aria-label="Reference details"
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Reference Detail
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            title="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/30 text-red-400 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Thumbnail Preview & Replace */}
          <div className="space-y-2">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-surface-subtle">
              {hasThumbnail ? (
                <>
                  <Image
                    src={thumbnailUrl}
                    alt={title || 'Reference'}
                    fill
                    className="object-cover"
                    onError={() => setImageError(true)}
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnailUrl('');
                      setImageError(false);
                    }}
                    className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                    title="Remove thumbnail"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-center p-6 text-muted-foreground/60">
                  <Globe className="h-8 w-8 stroke-[1.25] mb-1.5" />
                  <span className="text-xs font-mono text-muted-foreground">
                    {reference.source_domain}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleThumbnailUpload}
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSaving}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                <span>Replace Thumbnail</span>
              </button>

              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-mono"
              >
                <span>Visit {reference.source_domain || 'link'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Title Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="detail-title">
              Title
            </label>
            <Input
              id="detail-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              required
            />
          </div>

          {/* Source Domain & Date Metadata */}
          <div className="grid grid-cols-2 gap-3 py-2 border-y border-border-subtle text-xs">
            <div>
              <span className="text-muted-foreground/70 block text-[11px]">Domain</span>
              <span className="font-mono text-foreground font-medium">
                {reference.source_domain || 'External'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/70 block text-[11px] flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Saved on
              </span>
              <span className="text-foreground">{formattedDate}</span>
            </div>
          </div>

          {/* Tags Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="detail-tags">
              Tags <span className="text-muted-foreground/60">(press Enter to add)</span>
            </label>
            <Input
              id="detail-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="e.g. brutalism, typography, palette"
              disabled={isSaving}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-xs pr-1">
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="rounded-full hover:text-foreground text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Note Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="detail-note">
              Creative Notes
            </label>
            <Textarea
              id="detail-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add thoughts, observations, or aesthetic intentions..."
              disabled={isSaving}
              rows={3}
            />
          </div>

          {/* FEATURE 4 & 5: Creative Direction Bidirectional Integration */}
          <div className="rounded-lg border border-border bg-surface-subtle p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium text-foreground">
                  Creative Direction
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono py-0 px-1.5">
                  {linkedDirections.length}
                </Badge>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateDirectionOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline font-medium"
              >
                <Plus className="h-3 w-3" />
                <span>New statement</span>
              </button>
            </div>

            {/* List of Connected Direction Notes */}
            {isLoadingDirections ? (
              <div className="py-4 flex items-center justify-center">
                <LoadingSpinner size="sm" label="Loading linked directions..." />
              </div>
            ) : linkedDirections.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 leading-relaxed py-1">
                This reference hasn&apos;t been linked to any creative direction statements yet.
              </p>
            ) : (
              <div className="space-y-2 pt-1">
                {linkedDirections.map((dir) => (
                  <div
                    key={dir.id}
                    className="group/dir flex items-start justify-between gap-2 p-2.5 rounded-md border border-border bg-surface hover:border-border-strong transition-colors"
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-accent shrink-0" />
                        <h5 className="font-display text-xs font-medium text-foreground truncate">
                          {dir.title}
                        </h5>
                      </div>
                      {dir.description && (
                        <p className="text-[11px] text-muted-foreground/80 line-clamp-1 pl-4">
                          {dir.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => unlinkFromDirection(dir.id)}
                      className="text-muted-foreground hover:text-red-400 p-1 rounded hover:bg-surface-hover transition-colors"
                      title="Unlink from this direction"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Link Selector */}
            {unlinkedAvailableDirections.length > 0 && (
              <div className="pt-2 border-t border-border-subtle flex items-center gap-2">
                <select
                  value={selectedDirectionToLink}
                  onChange={(e) => setSelectedDirectionToLink(e.target.value)}
                  className="flex-1 h-8 rounded border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:border-accent"
                  disabled={isLinking}
                >
                  <option value="">+ Connect to existing direction...</option>
                  {unlinkedAvailableDirections.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleQuickLinkDirection}
                  disabled={!selectedDirectionToLink || isLinking}
                  className="h-8 px-2.5 text-xs shrink-0"
                >
                  {isLinking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Connect'}
                </Button>
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border bg-surface p-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSaving || isDeleting}
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
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Save Changes</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Reference"
        description={`Are you sure you want to delete "${reference.title}"? Any direction note links or moodboard items associated with this reference will be unlinked.`}
        confirmLabel="Delete Reference"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />

      {/* Create New Direction Statement Modal */}
      <CreateDirectionDialog
        projectId={projectId}
        open={isCreateDirectionOpen}
        onOpenChange={setIsCreateDirectionOpen}
        initialReferenceId={reference.id}
        onSubmit={async (input) => {
          const created = await directionService.createDirectionNote(input);
          await refetchDirections();
          const notes = await directionService.getDirectionNotes(projectId);
          setAvailableDirections(notes);
          return created;
        }}
      />
    </>
  );
}
