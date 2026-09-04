'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useMoodboard } from '../hooks/useMoodboard';
import { MoodboardToolbar } from './MoodboardToolbar';
import { MoodboardLibraryDrawer } from './MoodboardLibraryDrawer';
import { AddReferenceDialog } from '@/features/references/components/AddReferenceDialog';
import { referenceService } from '@/features/references/services/referenceService';
import { playgroundImageService } from '../services/playgroundImageService';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import type { Reference } from '@/features/references/types';
import type { MoodboardItem } from '../types';
import type { CreateReferenceInput } from '@/features/references/validation/referenceSchema';
import { FolderPlus, Type, Sparkles, Loader2, AlertCircle } from 'lucide-react';

// Dynamic Konva Stage import without SSR
const DynamicMoodboardStage = dynamic(
  () => import('../canvas/MoodboardStage').then((mod) => mod.MoodboardStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 w-full h-full flex items-center justify-center bg-[#121211]">
        <LoadingSpinner label="Initializing creative playground..." />
      </div>
    ),
  }
);

interface MoodboardCanvasProps {
  projectId: string;
  projectName?: string;
  readOnly?: boolean;
  initialItems?: MoodboardItem[];
}

export function MoodboardCanvas({
  projectId,
  projectName,
  readOnly = false,
  initialItems,
}: MoodboardCanvasProps) {
  const {
    items,
    selectedId,
    setSelectedId,
    viewport,
    setViewport,
    isLoading,
    error,
    canUndo,
    undo,
    nudgeItem,
    zoomToFit,
    recordUndoAction,
    addReferenceItem,
    addImageItem,
    addTextNote,
    addColorItem,
    addIdeaItem,
    duplicateItem,
    updateItemLocal,
    persistItemGeometry,
    updateTextContent,
    updateColorContent,
    updateIdeaContent,
    bringToFront,
    deleteItem,
    zoomIn,
    zoomOut,
    resetViewport,
  } = useMoodboard(projectId, initialItems, readOnly);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Exporter reference
  const exportFnRef = useRef<((name?: string) => Promise<boolean>) | null>(null);

  // URL reference capture modal on canvas paste
  const [isAddRefOpen, setIsAddRefOpen] = useState(false);
  const [pendingRefUrl, setPendingRefUrl] = useState<string>('');

  const handlePlaceReference = (reference: Reference) => {
    addReferenceItem(reference);
  };

  const handleDropReference = (rawReference: unknown, dropCoords: { x: number; y: number }) => {
    if (rawReference && typeof rawReference === 'object' && 'id' in rawReference) {
      addReferenceItem(rawReference as Reference, dropCoords);
    }
  };

  // Upload and place image file
  const handleUploadImageFile = useCallback(
    async (file: File | Blob, originalName?: string, position?: { x: number; y: number }) => {
      if (readOnly) return;
      setIsUploading(true);
      setUploadStatus('Compressing & uploading image...');
      setUploadError(null);
      try {
        const uploaded = await playgroundImageService.uploadPlaygroundImage(
          projectId,
          file,
          originalName
        );
        await addImageItem(uploaded.url, uploaded.width, uploaded.height, uploaded.fileName, position);
      } catch (err: unknown) {
        console.error('Failed to upload image:', err);
        const msg = err instanceof Error ? err.message : 'Failed to upload image. Please try again.';
        setUploadError(msg);
        setTimeout(() => setUploadError(null), 6000);
      } finally {
        setIsUploading(false);
        setUploadStatus(null);
      }
    },
    [projectId, addImageItem, readOnly]
  );

  // Handle files dropped from desktop
  const handleDropFiles = useCallback(
    async (files: FileList, dropPosition: { x: number; y: number }) => {
      if (readOnly) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const offsetPos = {
            x: dropPosition.x + i * 25,
            y: dropPosition.y + i * 25,
          };
          await handleUploadImageFile(file, file.name, offsetPos);
        }
      }
    },
    [handleUploadImageFile, readOnly]
  );

  // Global Clipboard paste listener
  useEffect(() => {
    if (readOnly) return;
    const handlePaste = async (e: ClipboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable ||
        isAddRefOpen
      ) {
        return;
      }

      // 1. Check for Image in clipboard items
      const clipboardItems = e.clipboardData?.items;
      if (clipboardItems) {
        for (let i = 0; i < clipboardItems.length; i++) {
          const item = clipboardItems[i];
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              await handleUploadImageFile(blob, 'Pasted Image');
              return;
            }
          }
        }
      }

      // 2. Check for Text in clipboard
      const pastedText = e.clipboardData?.getData('text/plain')?.trim();
      if (!pastedText) return;

      // If it's a URL -> trigger Reference Capture dialog
      if (/^https?:\/\//i.test(pastedText)) {
        e.preventDefault();
        setPendingRefUrl(pastedText);
        setIsAddRefOpen(true);
        return;
      }

      // If it's a HEX color code -> create Color swatch
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(pastedText)) {
        e.preventDefault();
        await addColorItem(pastedText.toUpperCase(), pastedText.toUpperCase());
        return;
      }

      // Otherwise -> create Text note
      e.preventDefault();
      await addTextNote(pastedText);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [readOnly, isAddRefOpen, handleUploadImageFile, addColorItem, addTextNote]);

  // Handle reference created from dialog and place on canvas
  const handleReferenceCreated = (newRef: Reference) => {
    addReferenceItem(newRef);
    setIsAddRefOpen(false);
  };

  const handleCreateReferenceSubmit = async (input: CreateReferenceInput): Promise<Reference> => {
    return await referenceService.createReference({
      projectId: input.projectId,
      url: input.url,
      title: input.title,
      thumbnailUrl: input.thumbnailUrl,
      sourceDomain: input.sourceDomain,
      note: input.note,
      tags: input.tags,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full h-[calc(100vh-140px)] min-h-[500px] flex items-center justify-center bg-[#121211]">
        <LoadingSpinner label="Loading creative playground..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 w-full h-[calc(100vh-140px)] min-h-[500px] flex flex-col items-center justify-center bg-[#121211] p-6 text-center">
        <p className="text-xs text-red-400 mb-3">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Reload Playground
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-[calc(100vh-140px)] min-h-[500px] overflow-hidden bg-[#121211]">
      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 shadow-floating animate-in fade-in-50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          <span className="text-xs font-medium text-foreground">{uploadStatus || 'Processing...'}</span>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-danger bg-surface px-4 py-1.5 shadow-floating animate-in fade-in-50 text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{uploadError}</span>
        </div>
      )}

      {/* Dynamic Konva Stage */}
      <DynamicMoodboardStage
        items={items}
        selectedId={selectedId}
        viewport={viewport}
        readOnly={readOnly}
        onViewportChange={setViewport}
        onSelectId={setSelectedId}
        onUpdateItemLocal={updateItemLocal}
        onPersistGeometry={persistItemGeometry}
        onBringToFront={bringToFront}
        onUpdateText={updateTextContent}
        onUpdateColor={updateColorContent}
        onUpdateIdea={updateIdeaContent}
        onDuplicateItem={duplicateItem}
        onDeleteItem={deleteItem}
        onDropReference={handleDropReference}
        onDropFiles={handleDropFiles}
        onUndo={undo}
        onNudge={nudgeItem}
        onZoomToFit={zoomToFit}
        onRecordUndoAction={recordUndoAction}
        onRegisterExport={(exporter) => {
          exportFnRef.current = exporter;
        }}
      />

      {/* Empty State Overlay when canvas is pristine */}
      {items.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-6">
          <div className="pointer-events-auto rounded-2xl border border-border bg-surface p-8 max-w-md shadow-floating space-y-4">
            <div className="h-10 w-10 mx-auto rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
              <Sparkles className="h-5 w-5" />
            </div>

            <div className="space-y-1">
              <h3 className="font-display text-xl font-medium tracking-tight text-foreground">
                {readOnly ? 'Empty Moodboard' : 'Your Creative Playground'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {readOnly
                  ? 'No items have been added to this moodboard yet.'
                  : 'Paste images, drop files, add thoughts, color swatches, or drag references from your library.'}
              </p>
            </div>

            {!readOnly && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => setIsLibraryOpen(true)}
                  className="gap-1.5 text-xs font-medium bg-accent text-white hover:bg-accent-hover"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span>Reference Library</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => addIdeaItem('Brand Direction', 'A quiet, tactile editorial presence')}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <span>Add Idea</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => addTextNote('Initial thought...')}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Type className="h-3.5 w-3.5" />
                  <span>Add Note</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Playground Toolbar */}
      <MoodboardToolbar
        scale={viewport.scale}
        selectedId={selectedId}
        readOnly={readOnly}
        canUndo={canUndo}
        onUndo={undo}
        isLibraryOpen={isLibraryOpen}
        onToggleLibrary={() => setIsLibraryOpen((prev) => !prev)}
        onUploadImageFile={(file) => handleUploadImageFile(file, file.name)}
        onAddTextNote={() => addTextNote('Creative Note')}
        onAddColor={() => addColorItem('#D97706', 'Primary Amber')}
        onAddIdea={() => addIdeaItem('Creative Direction', 'Focus on warmth, restraint, and tactile typography')}
        onDuplicateSelected={() => {
          if (selectedId) duplicateItem(selectedId);
        }}
        onDeleteSelected={() => {
          if (selectedId) deleteItem(selectedId);
        }}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetViewport}
        onZoomToFit={() => zoomToFit()}
        onExportImage={() => exportFnRef.current?.(projectName || 'moodboard')}
      />

      {!readOnly && (
        <>
          {/* Reference Library Drawer */}
          <MoodboardLibraryDrawer
            projectId={projectId}
            isOpen={isLibraryOpen}
            onClose={() => setIsLibraryOpen(false)}
            onPlaceReference={handlePlaceReference}
          />

          {/* URL Reference Capture Dialog */}
          {isAddRefOpen && (
            <AddReferenceDialog
              projectId={projectId}
              open={isAddRefOpen}
              initialUrl={pendingRefUrl}
              onOpenChange={(open) => {
                setIsAddRefOpen(open);
                if (!open) setPendingRefUrl('');
              }}
              onReferenceCreated={handleReferenceCreated}
              onSubmit={handleCreateReferenceSubmit}
            />
          )}
        </>
      )}
    </div>
  );
}
