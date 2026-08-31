'use client';

import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { thumbnailService } from '../services/thumbnailService';
import type { CreateReferenceInput } from '../validation/referenceSchema';
import { createReferenceSchema } from '../validation/referenceSchema';
import { extractDomain } from '@/lib/utils/url';
import { Upload, X, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface ManualEntryFallbackProps {
  projectId: string;
  initialUrl: string;
  initialTitle?: string;
  initialThumbnailUrl?: string;
  initialNote?: string;
  initialTags?: string[];
  notice?: string;
  onSave: (input: CreateReferenceInput) => Promise<void>;
  onCancel: () => void;
}

export function ManualEntryFallback({
  projectId,
  initialUrl,
  initialTitle = '',
  initialThumbnailUrl = '',
  initialNote = '',
  initialTags = [],
  notice,
  onSave,
  onCancel,
}: ManualEntryFallbackProps) {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle || extractDomain(initialUrl));
  const [thumbnailUrl, setThumbnailUrl] = useState(initialThumbnailUrl);
  const [note, setNote] = useState(initialNote);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initialTags);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const publicUrl = await thumbnailService.uploadThumbnail(projectId, file);
      setThumbnailUrl(publicUrl);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to upload thumbnail');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: CreateReferenceInput = {
      projectId,
      url,
      title: title.trim(),
      thumbnailUrl: thumbnailUrl.trim(),
      sourceDomain: extractDomain(url),
      note: note.trim(),
      tags,
    };

    const validation = createReferenceSchema.safeParse(payload);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Invalid reference details');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(validation.data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save reference');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {notice && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-medium">Direct preview unavailable:</span> {notice}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/30 text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* URL */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-url">
          Source URL
        </label>
        <Input
          id="manual-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isSubmitting}
          required
        />
      </div>

      {/* Title */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-title">
          Title <span className="text-red-400">*</span>
        </label>
        <Input
          id="manual-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Minimalist Packaging Specimen"
          disabled={isSubmitting}
          required
          autoFocus
        />
      </div>

      {/* Thumbnail Upload or Preview */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Thumbnail <span className="text-muted-foreground/60">(optional)</span>
        </label>

        <div className="flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 rounded-md border border-border bg-surface-subtle overflow-hidden flex items-center justify-center">
            {thumbnailUrl ? (
              <>
                <Image
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => setThumbnailUrl('')}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            )}
          </div>

          <div className="flex-1 space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSubmitting}
              className="gap-1.5 text-xs w-full sm:w-auto"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>Upload Custom Thumbnail</span>
            </Button>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Resized & compressed to ~400px before uploading to conserve storage.
            </p>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-tags">
          Tags <span className="text-muted-foreground/60">(press Enter to add)</span>
        </label>
        <Input
          id="manual-tags"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          placeholder="e.g. typography, layout, warm-palette"
          disabled={isSubmitting}
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 text-[11px] pr-1">
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

      {/* Note */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-note">
          Note <span className="text-muted-foreground/60">(optional)</span>
        </label>
        <Textarea
          id="manual-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What makes this reference notable? E.g., editorial grid hierarchy, restrained serif title..."
          disabled={isSubmitting}
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !title.trim() || !url.trim()}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Save Reference'
          )}
        </Button>
      </div>
    </form>
  );
}
