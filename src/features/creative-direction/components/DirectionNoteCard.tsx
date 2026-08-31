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
  onEdit: (note: DirectionNoteWithReferences) => void;
  onDeleteRequest: (note: DirectionNoteWithReferences) => void;
  onUnlinkReference: (directionNoteId: string, referenceId: string) => Promise<void>;
  onOpenReferencePicker: (note: DirectionNoteWithReferences) => void;
}

export function DirectionNoteCard({
  note,
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

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(note)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Edit direction statement"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteRequest(note)}
            className="h-8 w-8 text-muted-foreground hover:text-red-400"
            title="Delete direction statement"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Connected References Section */}
      <div className="border-t border-border-subtle pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              Connected References
            </span>
            <Badge variant="secondary" className="text-[10px] font-mono py-0 px-1.5">
              {note.references.length}
            </Badge>
          </div>

          <button
            type="button"
            onClick={() => onOpenReferencePicker(note)}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium"
          >
            <Plus className="h-3 w-3" />
            <span>Connect references</span>
          </button>
        </div>

        {/* References Strip / Grid */}
        {note.references.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-subtle bg-surface-subtle/50 p-5 text-center">
            <p className="text-xs text-muted-foreground/70">
              No references connected yet.
            </p>
            <button
              type="button"
              onClick={() => onOpenReferencePicker(note)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium"
            >
              <Plus className="h-3 w-3" /> Connect reference evidence
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-1">
            {note.references.map((ref: Reference) => (
              <div
                key={ref.id}
                className="group/ref relative flex flex-col overflow-hidden rounded-md border border-border bg-surface-subtle transition-all duration-150 hover:border-border-strong hover:bg-surface"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-hover/30 flex items-center justify-center">
                  {ref.thumbnail_url ? (
                    <Image
                      src={ref.thumbnail_url}
                      alt={ref.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <Globe className="h-5 w-5 text-muted-foreground/40" />
                  )}

                  {/* Domain Badge */}
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-foreground backdrop-blur-xs">
                    {ref.source_domain}
                  </span>

                  {/* Hover Unlink Action */}
                  <button
                    type="button"
                    onClick={() => onUnlinkReference(note.id, ref.id)}
                    className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white opacity-0 transition-opacity group-hover/ref:opacity-100 hover:bg-red-900"
                    title="Unlink reference from this direction"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Title & Link */}
                <div className="p-2 flex items-center justify-between gap-1">
                  <p className="text-[11px] font-medium text-foreground truncate" title={ref.title}>
                    {ref.title}
                  </p>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-accent"
                    title="Visit link"
                  >
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
