'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { referenceService } from '../services/referenceService';
import { ManualEntryFallback } from './ManualEntryFallback';
import type { CreateReferenceInput } from '../validation/referenceSchema';
import type { Reference } from '../types';
import type { ScrapedMetadata } from '@/types/common';
import { extractDomain, normalizeUrl } from '@/lib/utils/url';
import { Loader2, ArrowRight, X, AlertCircle, Link as LinkIcon, Edit3 } from 'lucide-react';
import Image from 'next/image';

interface AddReferenceDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReferenceCreated?: (reference: Reference) => void;
  onSubmit: (input: CreateReferenceInput) => Promise<Reference>;
}

type DialogStep = 'input' | 'preview' | 'manual';

export function AddReferenceDialog({
  projectId,
  open,
  onOpenChange,
  onReferenceCreated,
  onSubmit,
}: AddReferenceDialogProps) {
  const [step, setStep] = useState<DialogStep>('input');
  const [urlInput, setUrlInput] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scraped preview state
  const [scrapedData, setScrapedData] = useState<ScrapedMetadata | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState<string>('');

  const resetForm = () => {
    setStep('input');
    setUrlInput('');
    setIsScraping(false);
    setIsSaving(false);
    setError(null);
    setScrapedData(null);
    setTitle('');
    setNote('');
    setTagInput('');
    setTags([]);
    setFallbackNotice('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

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

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = normalizeUrl(urlInput);
    if (!cleanUrl) return;

    setError(null);
    setIsScraping(true);

    try {
      const result = await referenceService.scrapeMetadata(cleanUrl);

      if (result.fallbackNeeded || !result.success || !result.data.thumbnail_url) {
        // Fallback flow (e.g., Pinterest, Instagram, non-OG site)
        setFallbackNotice(
          `We couldn't automatically scrape preview images from ${extractDomain(
            cleanUrl
          )}. Please confirm title or upload a thumbnail.`
        );
        setScrapedData(result.data);
        setTitle(result.data.title || extractDomain(cleanUrl));
        setStep('manual');
      } else {
        // Normal preview flow
        setScrapedData(result.data);
        setTitle(result.data.title);
        setStep('preview');
      }
    } catch (err: unknown) {
      // Direct fallback on unexpected error
      setFallbackNotice('Link preview failed. Please enter details manually.');
      setStep('manual');
      if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setIsScraping(false);
    }
  };

  const handleSavePreview = async () => {
    if (!scrapedData) return;
    setIsSaving(true);
    setError(null);

    try {
      const payload: CreateReferenceInput = {
        projectId,
        url: scrapedData.url,
        title: title.trim() || scrapedData.title,
        thumbnailUrl: scrapedData.thumbnail_url || '',
        sourceDomain: scrapedData.source_domain || extractDomain(scrapedData.url),
        note: note.trim(),
        tags,
      };

      const created = await onSubmit(payload);
      handleOpenChange(false);
      if (onReferenceCreated) {
        onReferenceCreated(created);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save reference');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveManual = async (input: CreateReferenceInput) => {
    const created = await onSubmit(input);
    handleOpenChange(false);
    if (onReferenceCreated) {
      onReferenceCreated(created);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            {step === 'input' && 'Capture Reference'}
            {step === 'preview' && 'Review Reference'}
            {step === 'manual' && 'Add Reference Details'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'input' &&
              'Paste a URL from Pinterest, Cosmos, Behance, Arena, Instagram, or any site.'}
            {step === 'preview' &&
              'Metadata extracted. Add tags or notes before saving.'}
            {step === 'manual' &&
              'Confirm link details, upload a thumbnail, or add notes.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/30 text-red-400 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: URL Input */}
        {step === 'input' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="ref-url-input" className="text-xs font-medium text-muted-foreground">
                Paste link
              </label>
              <div className="relative">
                <Input
                  id="ref-url-input"
                  type="url"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isScraping}
                  autoFocus
                  required
                  className="pl-8"
                />
                <LinkIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('manual')}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Edit3 className="h-3 w-3" />
                <span>Enter details manually</span>
              </button>

              <Button
                type="submit"
                size="sm"
                disabled={isScraping || !urlInput.trim()}
              >
                {isScraping ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Fetching preview...
                  </>
                ) : (
                  <>
                    <span>Capture</span>
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Preview Card with live metadata */}
        {step === 'preview' && scrapedData && (
          <div className="space-y-4 py-2 w-full min-w-0 overflow-hidden">
            <div className="flex gap-3.5 p-3 rounded-lg border border-border bg-surface-subtle w-full min-w-0 overflow-hidden">
              {scrapedData.thumbnail_url && (
                <div className="relative h-20 w-20 shrink-0 rounded overflow-hidden border border-border bg-surface">
                  <Image
                    src={scrapedData.thumbnail_url}
                    alt={title || 'Preview'}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}

              <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
                <span className="text-[11px] font-mono text-accent truncate block">
                  {scrapedData.source_domain}
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-0.5 w-full min-w-0 bg-transparent font-display text-sm font-medium text-foreground focus:outline-none border-b border-transparent focus:border-accent truncate"
                  placeholder="Reference title"
                />
                <span className="text-[11px] text-muted-foreground truncate mt-0.5 block w-full" title={scrapedData.url}>
                  {scrapedData.url}
                </span>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="preview-tags">
                Tags <span className="text-muted-foreground/60">(press Enter to add)</span>
              </label>
              <Input
                id="preview-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="e.g. typography, layout, warm-palette"
                disabled={isSaving}
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
              <label className="text-xs font-medium text-muted-foreground" htmlFor="preview-note">
                Note <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Textarea
                id="preview-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why are you saving this reference?"
                disabled={isSaving}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep('manual')}
                disabled={isSaving}
                className="text-xs"
              >
                Edit all details
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setStep('input')}
                  disabled={isSaving}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSavePreview}
                  disabled={isSaving || !title.trim()}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save Reference'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Manual Fallback Mode */}
        {step === 'manual' && (
          <div className="py-2">
            <ManualEntryFallback
              projectId={projectId}
              initialUrl={urlInput || scrapedData?.url || ''}
              initialTitle={title || scrapedData?.title || ''}
              initialThumbnailUrl={scrapedData?.thumbnail_url || ''}
              initialNote={note || ''}
              initialTags={tags}
              notice={fallbackNotice}
              onSave={handleSaveManual}
              onCancel={() => setStep('input')}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
