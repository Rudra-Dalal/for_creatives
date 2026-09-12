'use client';

import React from 'react';
import {
  MousePointer,
  Film,
  Layers,
  ArrowUpRight,
  Pencil,
  Eraser,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { clampScale } from '../utils/storyboardCoordinates';
import type { StoryboardTool, StoryboardViewport } from '../types';

interface StoryboardToolbarProps {
  activeTool: StoryboardTool;
  onChangeActiveTool: (tool: StoryboardTool) => void;
  viewport: StoryboardViewport;
  onViewportChange: (viewport: StoryboardViewport) => void;
  onZoomToFit?: () => void;
  readOnly?: boolean;
}

export function StoryboardToolbar({
  activeTool,
  onChangeActiveTool,
  viewport,
  onViewportChange,
  onZoomToFit,
  readOnly = false,
}: StoryboardToolbarProps) {
  const handleZoom = (delta: number) => {
    const newScale = clampScale(viewport.scale + delta);
    onViewportChange({
      ...viewport,
      scale: newScale,
    });
  };

  const handleResetZoom = () => {
    onViewportChange({
      ...viewport,
      scale: 1.0,
    });
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-lg border border-border bg-surface/95 backdrop-blur-md px-2 py-1.5 shadow-lg">
      {/* Tool Selector Group */}
      {!readOnly && (
        <>
          <button
            type="button"
            onClick={() => onChangeActiveTool('select')}
            className={`flex items-center justify-center h-8 w-8 rounded transition-colors ${
              activeTool === 'select'
                ? 'bg-muted text-accent shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
            }`}
            title="Select & Move (V)"
          >
            <MousePointer className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onChangeActiveTool('shot')}
            className={`flex items-center justify-center h-8 w-8 rounded transition-colors ${
              activeTool === 'shot'
                ? 'bg-muted text-accent shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
            }`}
            title="Add Shot (S)"
          >
            <Film className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onChangeActiveTool('scene')}
            className={`flex items-center justify-center h-8 w-8 rounded transition-colors ${
              activeTool === 'scene'
                ? 'bg-muted text-accent shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
            }`}
            title="Add Scene Territory (C)"
          >
            <Layers className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onChangeActiveTool('connect')}
            className={`flex items-center justify-center h-8 w-8 rounded transition-colors ${
              activeTool === 'connect'
                ? 'bg-muted text-accent shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
            }`}
            title="Sequence Connection (X)"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onChangeActiveTool('pen')}
            className={`flex items-center justify-center h-8 w-8 rounded transition-colors ${
              activeTool === 'pen'
                ? 'bg-muted text-accent shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
            }`}
            title="Freehand Pen (P)"
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onChangeActiveTool('eraser')}
            className={`flex items-center justify-center h-8 w-8 rounded transition-colors ${
              activeTool === 'eraser'
                ? 'bg-muted text-accent shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
            }`}
            title="Eraser (E)"
          >
            <Eraser className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-border mx-1" />
        </>
      )}

      {/* Zoom Control Group */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => handleZoom(-0.15)}
          className="flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors"
          title="Zoom Out (Cmd -)"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={handleResetZoom}
          className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors"
          title="Reset Zoom to 100%"
        >
          {Math.round(viewport.scale * 100)}%
        </button>

        <button
          type="button"
          onClick={() => handleZoom(0.15)}
          className="flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors"
          title="Zoom In (Cmd +)"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        {onZoomToFit && (
          <button
            type="button"
            onClick={onZoomToFit}
            className="flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-surface-subtle transition-colors"
            title="Zoom to Fit (Shift+1 / Z)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
