'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Globe } from 'lucide-react';
import Image from 'next/image';
import { renderSanitizedMarkdown } from '../utils/markdown';
import {
  DIRECTION_CATEGORIES,
  type DirectionCategory,
  type DirectionNoteWithReferences,
} from '../types';

interface DirectionExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  directionNotes: DirectionNoteWithReferences[];
}

export function DirectionExportPdfModal({
  isOpen,
  onClose,
  projectName,
  directionNotes,
}: DirectionExportPdfModalProps) {
  const [selectedNoteId, setSelectedNoteId] = useState<string>('all');

  const notesToRender = useMemo(() => {
    if (selectedNoteId === 'all') return directionNotes;
    return directionNotes.filter((n) => n.id === selectedNoteId);
  }, [selectedNoteId, directionNotes]);

  const hasAnyCategorized = useMemo(() => {
    return selectedNoteId === 'all' && notesToRender.some((n) => !!n.category);
  }, [selectedNoteId, notesToRender]);

  const categoryGroups = useMemo(() => {
    if (!hasAnyCategorized) return [];

    const orderKeys: (DirectionCategory | 'uncategorized')[] = [
      ...DIRECTION_CATEGORIES,
      'uncategorized',
    ];

    const map = new Map<string, DirectionNoteWithReferences[]>();
    for (const key of orderKeys) {
      map.set(key, []);
    }

    for (const note of notesToRender) {
      const key = note.category || 'uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(note);
    }

    return orderKeys
      .map((key) => ({
        key,
        label: key === 'uncategorized' ? '—' : key,
        notes: map.get(key) || [],
      }))
      .filter((group) => group.notes.length > 0);
  }, [notesToRender, hasAnyCategorized]);

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date());
    } catch {
      return '';
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const renderNoteArticle = (note: DirectionNoteWithReferences, index: number) => {
    const html = renderSanitizedMarkdown(note.description || '');

    return (
      <article
        key={note.id}
        className="space-y-6 pb-10 border-b border-border/50 print:border-neutral-200 last:border-b-0 print:break-inside-avoid"
      >
        {/* Statement Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-accent print:text-neutral-600">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span>—</span>
            {note.category ? (
              <span className="uppercase font-semibold tracking-wider">
                {note.category}
              </span>
            ) : (
              <span>Statement</span>
            )}
          </div>

          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground print:text-black">
            {note.title}
          </h2>

          {note.description && (
            html ? (
              <div
                className="prose-direction text-sm text-muted-foreground print:text-neutral-700 leading-relaxed max-w-2xl font-serif"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <p className="text-sm text-muted-foreground print:text-neutral-700 leading-relaxed max-w-2xl font-serif whitespace-pre-line">
                {note.description}
              </p>
            )
          )}
        </div>

        {/* Connected References Section */}
        {note.references && note.references.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground/80 print:text-neutral-500">
              Supporting References ({note.references.length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {note.references.map((ref) => (
                <div
                  key={ref.id}
                  className="rounded-lg border border-border print:border-neutral-200 bg-surface-subtle print:bg-neutral-50 p-3 space-y-2 overflow-hidden"
                >
                  {ref.thumbnail_url ? (
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-black/20">
                      <Image
                        src={ref.thumbnail_url}
                        alt={ref.title || 'Reference'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] w-full rounded bg-surface border border-border flex items-center justify-center text-muted-foreground">
                      <Globe className="h-6 w-6 stroke-[1.25]" />
                    </div>
                  )}

                  <div>
                    <h4 className="font-display text-xs font-medium text-foreground print:text-black line-clamp-1">
                      {ref.title}
                    </h4>
                    {ref.source_domain && (
                      <span className="font-mono text-[10px] text-muted-foreground print:text-neutral-500 block">
                        {ref.source_domain}
                      </span>
                    )}
                    {ref.note && (
                      <p className="text-[11px] text-muted-foreground/80 print:text-neutral-600 line-clamp-2 mt-1 leading-relaxed">
                        {ref.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 border-border bg-surface shadow-floating overflow-hidden">
        {/* Modal Header (Hidden during Print) */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border bg-surface print:hidden flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              <span>Export Creative Direction to PDF</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Publication-grade editorial document layout for client presentations and review.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedNoteId}
              onChange={(e) => setSelectedNoteId(e.target.value)}
              className="h-8 rounded border border-border bg-surface-subtle px-2.5 text-xs text-foreground focus:outline-none focus:border-accent"
            >
              <option value="all">All Statements ({directionNotes.length})</option>
              {directionNotes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </div>
        </DialogHeader>

        {/* Printable Document Preview */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-[#0d0d0c] print:p-0 print:bg-white print:text-black">
          <div className="max-w-3xl mx-auto space-y-12 print:max-w-none print:m-0">
            {/* Document Header */}
            <div className="border-b border-border print:border-neutral-300 pb-6 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground print:text-neutral-500">
                <span>Creative Direction Document</span>
                <span>{formattedDate}</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground print:text-black">
                {projectName}
              </h1>
            </div>

            {/* Statements List */}
            {notesToRender.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No creative direction statements to export.
              </div>
            ) : hasAnyCategorized ? (
              <div className="space-y-12">
                {categoryGroups.map((group) => (
                  <section key={group.key} className="space-y-6">
                    <div className="flex items-center justify-between pb-2 border-b border-border print:border-neutral-300">
                      <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground print:text-neutral-600 font-semibold">
                        {group.label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground/60 print:text-neutral-500">
                        {group.notes.length}
                      </span>
                    </div>

                    <div className="space-y-8">
                      {group.notes.map((note, idx) => renderNoteArticle(note, idx))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {notesToRender.map((note, idx) => renderNoteArticle(note, idx))}
              </div>
            )}

            {/* Document Footer */}
            <div className="pt-8 border-t border-border print:border-neutral-300 flex items-center justify-between text-[11px] font-mono text-muted-foreground/60 print:text-neutral-400">
              <span>Created with For Creatives</span>
              <span>Visual Creative Playground</span>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden during Print) */}
        <DialogFooter className="p-4 border-t border-border bg-surface print:hidden flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 font-medium bg-accent text-white hover:bg-accent-hover"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print or Save as PDF</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
