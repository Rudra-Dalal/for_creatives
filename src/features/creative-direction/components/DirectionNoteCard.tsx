'use client';

import React from 'react';
import type { DirectionNoteWithReferences } from '../types';
import type { Reference } from '@/features/references/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Edit3,
  Trash2,
  Plus,
  X,
  Globe,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';

interface DirectionNoteCardProps {
  note: DirectionNoteWithReferences;
  readOnly?: boolean;
  onEdit?: (note: DirectionNoteWithReferences) => void;
  onDeleteRequest?: (note: DirectionNoteWithReferences) => void;
  onUnlinkReference?: (directionNoteId: string, referenceId: string) => Promise<void>;
  onOpenReferencePicker?: (note: DirectionNoteWithReferences) => void;
}

export function DirectionNoteCard({
  note,
  readOnly = false,
  onEdit,
  onDeleteRequest,
  onUnlinkReference,
  onOpenReferencePicker,
}: DirectionNoteCardProps) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(note.created_at));

  return (
    <article className="group relative flex flex-col rounded-xl border border-border bg-surface p-6 transition-all duration-200 hover:border-border-strong shadow-subtle space-y-5">
      {/* Top Header: Statement & Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-accent">
              <Sparkles className="h-3 w-3" /> Creative Statement
            </span>
            <span className="text-border-strong">•</span>
            <span className="text-[11px] text-muted-foreground/60">{formattedDate}</span>
          </div>

          <h3 className="font-display text-2xl font-medium tracking-tight text-foreground leading-tight pt-1">
            {note.title}
          </h3>

          {note.description && (
            <p className="text-xs text-muted-foreground leading-relaxed pt-1 whitespace-pre-line max-w-3xl">
              {note.description}
            </p>
          )}
        </div>

        {/* Action Controls (Only for project owner) */}
        {!readOnly && onEdit && onDeleteRequest && (
          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onEdit(note)}
              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
              title="Edit statement"
            >
              <Edit3 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onDeleteRequest(note)}
              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-danger/10 hover:text-red-400 transition-colors"
              title="Delete statement"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
          <div className="rounded-lg border border-dashed border-border-subtle p-4 text-center">
            <p className="text-xs text-muted-foreground/60 italic">
              No references connected to this direction statement yet.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
