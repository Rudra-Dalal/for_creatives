'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Type,
  FolderPlus,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface MoodboardToolbarProps {
  scale: number;
  selectedId: string | null;
  isLibraryOpen: boolean;
  onToggleLibrary: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onAddTextNote: () => void;
  onDeleteSelected: () => void;
}

export function MoodboardToolbar({
  scale,
  selectedId,
  isLibraryOpen,
  onToggleLibrary,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onAddTextNote,
  onDeleteSelected,
}: MoodboardToolbarProps) {
  const percentage = Math.round(scale * 100);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-border bg-surface/90 backdrop-blur-md px-3 py-1.5 shadow-floating">
      {/* Reference Library Drawer Toggle */}
      <Button
        variant={isLibraryOpen ? 'default' : 'ghost'}
        size="sm"
        onClick={onToggleLibrary}
        className="h-8 rounded-full gap-1.5 px-3 text-xs font-medium"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        <span>Add References</span>
      </Button>

      {/* Add Text Note */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddTextNote}
        className="h-8 rounded-full gap-1.5 px-3 text-xs font-medium text-foreground hover:bg-surface-hover"
      >
        <Type className="h-3.5 w-3.5 text-accent" />
        <span>Add Note</span>
      </Button>

      <div className="h-4 w-px bg-border-subtle mx-1" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onZoomOut}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onResetZoom}
          className="px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded"
          title="Reset Zoom (100%)"
        >
          {percentage}%
        </button>

        <button
          type="button"
          onClick={onZoomIn}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onResetZoom}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          title="Fit / Center"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Delete Selected Item if any */}
      {selectedId && (
        <>
          <div className="h-4 w-px bg-border-subtle mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteSelected}
            className="h-8 rounded-full gap-1.5 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-danger/10"
            title="Remove item from canvas"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Remove</span>
          </Button>
        </>
      )}
    </div>
  );
}
