'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { renderSanitizedMarkdown } from '../utils/markdown';
import type { DirectionNoteWithReferences } from '../types';
import type { Reference } from '@/features/references/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Edit3,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Globe,
  ArrowUpRight,
} from 'lucide-react';
import Image from 'next/image';

interface DirectionNoteCardProps {
  note: DirectionNoteWithReferences;
  readOnly?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isJustDuplicated?: boolean;
  onEdit?: (note: DirectionNoteWithReferences) => void;
  onDeleteRequest?: (note: DirectionNoteWithReferences) => void;
  onDuplicate?: (note: DirectionNoteWithReferences) => void;
  onReorder?: (note: DirectionNoteWithReferences, direction: 'up' | 'down') => void;
  onUnlinkReference?: (directionNoteId: string, referenceId: string) => Promise<void>;
  onOpenReferencePicker?: (note: DirectionNoteWithReferences) => void;
}

export function DirectionNoteCard({
  note,
  readOnly = false,
  isFirst = false,
  isLast = false,
  isJustDuplicated = false,
  onEdit,
  onDeleteRequest,
  onDuplicate,
  onReorder,
  onUnlinkReference,
  onOpenReferencePicker,
}: DirectionNoteCardProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(note.created_at));
    } catch {
      return '';
    }
  }, [note.created_at]);

  const sanitizedHtml = useMemo(() => {
    if (!note.description || !isMounted) return '';
    return renderSanitizedMarkdown(note.description);
  }, [note.description, isMounted]);

  return (
    <article
      className={`group relative flex flex-col rounded-xl border bg-surface p-6 transition-all duration-300 shadow-subtle space-y-5 ${
        isJustDuplicated
          ? 'border-accent ring-1 ring-accent/40 animate-pulse'
          : 'border-border hover:border-border-strong'
      }`}
    >
      {/* Top Header: Category, Date, Statement & Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {note.category && (
              <>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent/80 font-medium">
                  {note.category}
                </span>
                <span className="text-border-strong">•</span>
              </>
            )}
            <span className="font-mono text-[11px] text-muted-foreground/60">
              {formattedDate}
            </span>
          </div>

          <h3 className="font-display text-2xl font-medium tracking-tight text-foreground leading-tight pt-1">
            {note.title}
          </h3>

          {note.description && (
            isMounted && sanitizedHtml ? (
              <div
                className="prose-direction pt-1 max-w-3xl"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed pt-1 whitespace-pre-line max-w-3xl">
                {note.description}
              </p>
            )
          )}
        </div>

        {/* Action Controls (Hidden until group-hover; only for project owner) */}
        {!readOnly && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onReorder && (
              <>
                <button
                  type="button"
                  onClick={() => onReorder(note, 'up')}
                  disabled={isFirst}
                  className={`flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors ${
                    isFirst
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-surface-hover hover:text-foreground cursor-pointer'
                  }`}
                  title="Move up"
                  aria-label="Move statement up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onReorder(note, 'down')}
                  disabled={isLast}
                  className={`flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors ${
                    isLast
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-surface-hover hover:text-foreground cursor-pointer'
                  }`}
                  title="Move down"
                  aria-label="Move statement down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </>
            )}

            {onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(note)}
                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
                title="Duplicate statement"
                aria-label="Duplicate statement"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(note)}
                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
                title="Edit statement"
                aria-label="Edit statement"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}

            {onDeleteRequest && (
              <button
                type="button"
                onClick={() => onDeleteRequest(note)}
                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-danger/10 hover:text-red-400 transition-colors"
                title="Delete statement"
                aria-label="Delete statement"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Linked References Section */}
      <div className="space-y-3 pt-2 border-t border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Connected References
            </span>
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
              {note.references?.length || 0}
            </Badge>
          </div>

          {!readOnly && onOpenReferencePicker && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenReferencePicker(note)}
              className="h-7 text-xs gap-1 text-accent hover:text-accent font-medium px-2"
            >
              <Plus className="h-3 w-3" />
              <span>Connect Reference</span>
            </Button>
          )}
        </div>

        {/* References Grid */}
        {note.references && note.references.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {note.references.map((ref: Reference) => (
              <div
                key={ref.id}
                className="group/item relative flex items-start gap-3 rounded-lg border border-border bg-surface-subtle p-2.5 transition-colors hover:border-border-strong hover:bg-surface"
              >
                {/* Thumbnail Preview */}
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-surface border border-border">
                  {ref.thumbnail_url ? (
                    <Image
                      src={ref.thumbnail_url}
                      alt={ref.title || 'Reference'}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
                      <Globe className="h-5 w-5 stroke-[1.25]" />
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex-1 min-w-0 pr-6 space-y-0.5">
                  <h4 className="font-display text-xs font-medium text-foreground line-clamp-1">
                    {ref.title}
                  </h4>

                  {ref.source_domain && (
                    <span className="font-mono text-[10px] text-muted-foreground/70 block">
                      {ref.source_domain}
                    </span>
                  )}

                  {ref.note && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {ref.note}
                    </p>
                  )}
                </div>

                {/* External Link */}
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground transition-colors"
                  title="Visit source"
                >
                  <ArrowUpRight className="h-3 w-3" />
                </a>

                {/* Unlink Action (Only for owners) */}
                {!readOnly && onUnlinkReference && (
                  <button
                    type="button"
                    onClick={() => onUnlinkReference(note.id, ref.id)}
                    className="absolute bottom-2 right-2 opacity-0 group-hover/item:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-danger/10 hover:text-red-400 transition-all"
                    title="Unlink reference from statement"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic py-1">
            No references connected yet.
          </p>
        )}
      </div>
    </article>
  );
}
