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
  Compass,
  LayoutGrid,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Columns,
  Rows,
  PenTool,
  Eraser,
} from 'lucide-react';
import type { MoodboardItem } from '../types';
import type { AlignmentType, DistributionType } from '../utils/layoutUtils';

interface MoodboardToolbarProps {
  scale: number;
  selectedId: string | null;
  selectedCount?: number;
  readOnly?: boolean;
  activeTool?: 'select' | 'pen' | 'eraser';
  onTogglePenTool?: () => void;
  onToggleEraserTool?: () => void;
  penColor?: string;
  onOpenPenColorPicker?: () => void;
  penWidth?: number;
  onChangePenWidth?: (width: number) => void;
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
  selectedItemType?: MoodboardItem['type'];
  selectedReferenceLinksCount?: number;
  onOpenDirectionInspector?: () => void;
  onPromoteSelectedIdea?: () => void;
  onAlign?: (alignment: AlignmentType) => void;
  onDistribute?: (direction: DistributionType) => void;
  onAutoArrange?: () => void;
  selectedConnectionId?: string | null;
  onDeleteSelectedConnection?: () => void;
}

export function MoodboardToolbar({
  scale,
  selectedId,
  selectedCount = 0,
  readOnly = false,
  activeTool = 'select',
  onTogglePenTool,
  onToggleEraserTool,
  penColor = '#D97706',
  onOpenPenColorPicker,
  penWidth = 4,
  onChangePenWidth,
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
  selectedItemType,
  selectedReferenceLinksCount,
  onOpenDirectionInspector,
  onPromoteSelectedIdea,
  onAlign,
  onDistribute,
  onAutoArrange,
  selectedConnectionId,
  onDeleteSelectedConnection,
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 shadow-floating">
      {!readOnly && (
        <>
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

          {/* Pen / Scribble Drawing Tool Toggle */}
          <Button
            variant={activeTool === 'pen' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onTogglePenTool}
            className={`h-8 rounded-full gap-1.5 px-3 text-xs font-medium transition-colors ${
              activeTool === 'pen'
                ? 'bg-accent/15 text-accent border border-accent/40 hover:bg-accent/20'
                : 'text-foreground hover:bg-surface-hover'
            }`}
            title="Pen / Scribble Drawing Tool (P)"
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>Draw</span>
            <span className="text-[10px] font-mono opacity-60 ml-0.5">P</span>
          </Button>

          {/* Whole-Stroke Eraser Tool Toggle */}
          <Button
            variant={activeTool === 'eraser' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleEraserTool}
            className={`h-8 rounded-full gap-1.5 px-3 text-xs font-medium transition-colors ${
              activeTool === 'eraser'
                ? 'bg-accent/15 text-accent border border-accent/40 hover:bg-accent/20'
                : 'text-foreground hover:bg-surface-hover'
            }`}
            title="Whole-Stroke Eraser (E or Shift+P)"
          >
            <Eraser className="h-3.5 w-3.5" />
            <span>Erase</span>
            <span className="text-[10px] font-mono opacity-60 ml-0.5">E</span>
          </Button>

          {/* When Pen Mode is active, reveal restrained styling controls: Color swatch & 3-step width toggle */}
          {activeTool === 'pen' && (
            <div className="flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full bg-surface-subtle/80 border border-border/70">
              {/* Color Swatch Trigger */}
              <button
                type="button"
                onClick={onOpenPenColorPicker}
                className="flex items-center justify-center h-6 w-6 rounded-full hover:bg-surface-hover transition-colors"
                title="Change Pen Color"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-border/80 shadow-sm shrink-0"
                  style={{ backgroundColor: penColor || '#D97706' }}
                />
              </button>

              {/* Discrete 3-step Stroke Width: 2px, 4px, 8px */}
              <div className="flex items-center gap-0.5 border-l border-border/60 pl-1">
                {[
                  { width: 2, label: 'Fine', indicator: 'h-1 w-1' },
                  { width: 4, label: 'Med', indicator: 'h-1.5 w-1.5' },
                  { width: 8, label: 'Bold', indicator: 'h-2 w-2' },
                ].map((step) => {
                  const isActive = (penWidth || 4) === step.width;
                  return (
                    <button
                      key={step.width}
                      type="button"
                      onClick={() => onChangePenWidth?.(step.width)}
                      className={`h-6 px-1.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                        isActive
                          ? 'bg-accent/20 text-accent font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'
                      }`}
                      title={`${step.label} (${step.width}px)`}
                    >
                      <span
                        className={`rounded-full bg-current ${step.indicator}`}
                      />
                      <span className="text-[10px]">{step.width}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          {/* Auto-Arrange Grid Button */}
          {onAutoArrange && (
            <button
              type="button"
              onClick={onAutoArrange}
              className="flex h-7 items-center gap-1.5 px-2.5 rounded-full text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
              title="Auto-arrange items into an organized grid"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-accent" />
              <span>Arrange</span>
            </button>
          )}

          <div className="h-4 w-px bg-border-subtle mx-1" />
        </>
      )}

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
      {(selectedId || selectedCount > 0) && !readOnly && (
        <>
          <div className="h-4 w-px bg-border-subtle mx-1" />

          {selectedCount > 1 && (
            <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-surface-subtle border border-border">
              {selectedCount} selected
            </span>
          )}

          {/* Align & Distribute Menu for Multi-Selection */}
          {selectedCount > 1 && onAlign && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-7 items-center gap-1 px-2.5 rounded-full text-xs font-medium text-foreground bg-surface-subtle hover:bg-surface-hover border border-border transition-colors cursor-pointer"
                  title="Align and distribute selected items"
                >
                  <AlignLeft className="h-3.5 w-3.5 text-accent" />
                  <span>Align</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                side="top"
                className="w-48 bg-[#181816] border-[#2A2A26] p-1 shadow-floating text-foreground"
              >
                <DropdownMenuItem onClick={() => onAlign('left')} className="gap-2 text-xs cursor-pointer">
                  <AlignLeft className="h-3.5 w-3.5 text-accent" />
                  <span>Align Left</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAlign('center-h')} className="gap-2 text-xs cursor-pointer">
                  <AlignCenter className="h-3.5 w-3.5 text-accent" />
                  <span>Align Center (H)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAlign('right')} className="gap-2 text-xs cursor-pointer">
                  <AlignRight className="h-3.5 w-3.5 text-accent" />
                  <span>Align Right</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#2A2A26]" />
                <DropdownMenuItem onClick={() => onAlign('top')} className="gap-2 text-xs cursor-pointer">
                  <AlignStartVertical className="h-3.5 w-3.5 text-accent" />
                  <span>Align Top</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAlign('center-v')} className="gap-2 text-xs cursor-pointer">
                  <AlignCenterVertical className="h-3.5 w-3.5 text-accent" />
                  <span>Align Middle (V)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAlign('bottom')} className="gap-2 text-xs cursor-pointer">
                  <AlignEndVertical className="h-3.5 w-3.5 text-accent" />
                  <span>Align Bottom</span>
                </DropdownMenuItem>
                {selectedCount >= 3 && onDistribute && (
                  <>
                    <DropdownMenuSeparator className="bg-[#2A2A26]" />
                    <DropdownMenuItem onClick={() => onDistribute('horizontal')} className="gap-2 text-xs cursor-pointer">
                      <Columns className="h-3.5 w-3.5 text-accent" />
                      <span>Distribute Horizontally</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDistribute('vertical')} className="gap-2 text-xs cursor-pointer">
                      <Rows className="h-3.5 w-3.5 text-accent" />
                      <span>Distribute Vertically</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Reference Direction Inspector Trigger */}
          {selectedCount <= 1 && selectedItemType === 'reference' && onOpenDirectionInspector && (
            <button
              type="button"
              onClick={onOpenDirectionInspector}
              className="flex h-7 items-center gap-1.5 px-2.5 rounded-full text-xs font-medium text-foreground bg-surface-subtle hover:bg-surface-hover border border-border transition-colors cursor-pointer"
              title="Open Creative Direction notes for this reference"
            >
              <Compass className="h-3.5 w-3.5 text-accent" />
              <span className="hidden sm:inline">Directions</span>
              {selectedReferenceLinksCount !== undefined && selectedReferenceLinksCount > 0 && (
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-accent/20 text-accent font-semibold">
                  {selectedReferenceLinksCount}
                </span>
              )}
            </button>
          )}

          {/* Idea Promotion Trigger */}
          {selectedCount <= 1 && selectedItemType === 'idea' && onPromoteSelectedIdea && (
            <button
              type="button"
              onClick={onPromoteSelectedIdea}
              className="flex h-7 items-center gap-1.5 px-2.5 rounded-full text-xs font-medium text-foreground bg-surface-subtle hover:bg-surface-hover border border-border transition-colors cursor-pointer"
              title="Promote this idea to a Creative Direction statement"
            >
              <Compass className="h-3.5 w-3.5 text-accent" />
              <span className="hidden sm:inline">Promote</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDuplicateSelected}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
            title={selectedCount > 1 ? `Duplicate ${selectedCount} items (Cmd+D)` : 'Duplicate (Cmd+D)'}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-danger/10 hover:text-red-300 transition-colors"
            title={selectedCount > 1 ? `Delete ${selectedCount} items (Backspace)` : 'Delete (Backspace)'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {/* Contextual Connection Actions */}
      {selectedConnectionId && !readOnly && (
        <>
          <div className="h-4 w-px bg-border-subtle mx-1" />
          <span className="font-mono text-[10px] text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/30">
            Arrow Selected
          </span>
          {onDeleteSelectedConnection && (
            <button
              type="button"
              onClick={onDeleteSelectedConnection}
              className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:bg-danger/10 hover:text-red-300 transition-colors cursor-pointer"
              title="Delete Arrow (Backspace)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
