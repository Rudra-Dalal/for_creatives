'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useMoodboard } from '../hooks/useMoodboard';
import { MoodboardToolbar } from './MoodboardToolbar';
import { MoodboardLibraryDrawer } from './MoodboardLibraryDrawer';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import type { Reference } from '@/features/references/types';
import { FolderPlus, Type, Sparkles } from 'lucide-react';

// Dynamic Konva Stage import without SSR
const DynamicMoodboardStage = dynamic(
  () => import('../canvas/MoodboardStage').then((mod) => mod.MoodboardStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 w-full h-full flex items-center justify-center bg-[#121210]">
        <LoadingSpinner label="Initializing spatial canvas..." />
      </div>
    ),
  }
);

interface MoodboardCanvasProps {
  projectId: string;
}

export function MoodboardCanvas({ projectId }: MoodboardCanvasProps) {
  const {
    items,
    selectedId,
    setSelectedId,
    viewport,
    setViewport,
    isLoading,
    error,
    addReferenceItem,
    addTextNote,
    updateItemLocal,
    persistItemGeometry,
    updateTextContent,
    bringToFront,
    deleteItem,
    zoomIn,
    zoomOut,
    resetViewport,
  } = useMoodboard(projectId);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const handlePlaceReference = (reference: Reference) => {
    addReferenceItem(reference);
  };

  const handleDropReference = (rawReference: unknown, dropCoords: { x: number; y: number }) => {
    if (rawReference && typeof rawReference === 'object' && 'id' in rawReference) {
      addReferenceItem(rawReference as Reference, dropCoords);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full h-[calc(100vh-140px)] min-h-[500px] flex items-center justify-center bg-[#121210]">
        <LoadingSpinner label="Loading moodboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 w-full h-[calc(100vh-140px)] min-h-[500px] flex flex-col items-center justify-center bg-[#121210] p-6 text-center">
        <p className="text-xs text-red-400 mb-3">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Reload Canvas
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-[calc(100vh-140px)] min-h-[500px] overflow-hidden bg-[#121210]">
      {/* Dynamic Konva Stage */}
      <DynamicMoodboardStage
        items={items}
        selectedId={selectedId}
        viewport={viewport}
        onViewportChange={setViewport}
        onSelectId={setSelectedId}
        onUpdateItemLocal={updateItemLocal}
        onPersistGeometry={persistItemGeometry}
        onBringToFront={bringToFront}
        onUpdateText={updateTextContent}
        onDeleteItem={deleteItem}
        onDropReference={handleDropReference}
      />

      {/* Empty State Overlay when no items exist */}
      {items.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-6">
          <div className="pointer-events-auto rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-md p-8 max-w-md shadow-floating space-y-4">
            <div className="h-10 w-10 mx-auto rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
              <Sparkles className="h-5 w-5" />
            </div>

            <div className="space-y-1">
              <h3 className="font-display text-xl font-medium tracking-tight text-foreground">
                Start building your visual world.
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Drag references from your library or drop editorial notes onto the spatial canvas to explore visual connections.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => setIsLibraryOpen(true)}
                className="gap-1.5 text-xs font-medium"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>Open Reference Library</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => addTextNote('Aesthetic Direction')}
                className="gap-1.5 text-xs font-medium"
              >
                <Type className="h-3.5 w-3.5" />
                <span>Add Text Note</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      <MoodboardToolbar
        scale={viewport.scale}
        selectedId={selectedId}
        isLibraryOpen={isLibraryOpen}
        onToggleLibrary={() => setIsLibraryOpen((prev) => !prev)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetViewport}
        onAddTextNote={() => addTextNote('Creative Note')}
        onDeleteSelected={() => {
          if (selectedId) deleteItem(selectedId);
        }}
      />

      {/* Reference Library Drawer */}
      <MoodboardLibraryDrawer
        projectId={projectId}
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onPlaceReference={handlePlaceReference}
      />
    </div>
  );
}
