'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Image as ImageIcon,
  Type,
  Palette,
  Sparkles,
  FolderPlus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Trash2,
  RotateCcw,
  Download,
} from 'lucide-react';

interface MoodboardToolbarProps {
  scale: number;
  selectedId: string | null;
  canUndo?: boolean;
  onUndo?: () => void;
  isLibraryOpen: boolean;
  onToggleLibrary: () => void;
  onUploadImageFile: (file: File) => void;
  onAddTextNote: () => void;
  onAddColor: () => void;
  onAddIdea: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomToFit?: () => void;
  onExportImage?: () => void;
}

export function MoodboardToolbar({
  scale,
  selectedId,
  canUndo,
  onUndo,
  isLibraryOpen,
  onToggleLibrary,
  onUploadImageFile,
  onAddTextNote,
  onAddColor,
  onAddIdea,
  onDuplicateSelected,
  onDeleteSelected,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onZoomToFit,
  onExportImage,
}: MoodboardToolbarProps) {
  const percentage = Math.round(scale * 100);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImageFile(file);
    }
    if (e.target) e.target.value = '';
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-border bg-surface/90 backdrop-blur-md px-3 py-1.5 shadow-floating">
      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
      />

      {/* Primary ADD Dropdown Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="h-8 rounded-full gap-1.5 px-3 text-xs font-medium bg-accent text-white hover:bg-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" sideOffset={10} className="w-48">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 text-xs">
            <ImageIcon className="h-3.5 w-3.5 text-accent" />
            <span>Upload Image</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onAddTextNote} className="gap-2 text-xs">
            <Type className="h-3.5 w-3.5 text-accent" />
            <span>Text Note</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onAddColor} className="gap-2 text-xs">
            <Palette className="h-3.5 w-3.5 text-accent" />
            <span>Color Swatch</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onAddIdea} className="gap-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Creative Idea</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onToggleLibrary} className="gap-2 text-xs">
            <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Reference Library</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reference Library Drawer Quick Button */}
      <Button
        variant={isLibraryOpen ? 'secondary' : 'ghost'}
        size="sm"
        onClick={onToggleLibrary}
        className="h-8 rounded-full gap-1.5 px-3 text-xs font-medium text-foreground hover:bg-surface-hover"
      >
        <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
        <span>Library</span>
      </Button>

      {/* Undo Button (Subtle, contextual) */}
      {canUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="flex h-7 items-center gap-1 px-2 rounded-full text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          title="Undo last canvas action (Cmd/Ctrl+Z)"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Undo</span>
        </button>
      )}

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
          onClick={() => {
            if (onZoomToFit) {
              onZoomToFit();
            } else {
              onResetZoom();
            }
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          title="Zoom to Fit (Cmd+0)"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Export PNG Button */}
      {onExportImage && (
        <>
          <div className="h-4 w-px bg-border-subtle mx-1" />
          <button
            type="button"
            onClick={onExportImage}
            className="flex h-7 items-center gap-1 px-2 rounded-full text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
            title="Export Moodboard as PNG"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </>
      )}

      {/* Contextual Item Actions (Duplicate / Delete) */}
      {selectedId && (
        <>
          <div className="h-4 w-px bg-border-subtle mx-1" />

          <button
            type="button"
            onClick={onDuplicateSelected}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
            title="Duplicate (Cmd+D)"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-danger/10 hover:text-red-300 transition-colors"
            title="Delete (Backspace)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
