'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import type { MoodboardItem, ColorItemContent } from '../types';
import type { CreateReferenceInput } from '@/features/references/validation/referenceSchema';
import { CanvasDirectionInspector } from './CanvasDirectionInspector';
import { ColorSwatchDialog } from './ColorSwatchDialog';
import { useProjectDirectionLinks } from '../hooks/useProjectDirectionLinks';
import { FolderPlus, Type, Sparkles, Palette, Loader2, AlertCircle } from 'lucide-react';

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
  onNavigateToDirection?: (directionNoteId: string) => void;
}

export function MoodboardCanvas({
  projectId,
  projectName,
  readOnly = false,
  initialItems,
  onNavigateToDirection,
}: MoodboardCanvasProps) {
  const {
    items,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    toggleSelectedId,
    viewport,
    setViewport,
    isLoading,
    error,
    saveStatus,
    saveError,
    clearSaveError,
    canUndo,
    undo,
    nudgeItem,
    nudgeSelectedItems,
    zoomToFit,
    recordUndoAction,
    addReferenceItem,
    addImageItem,
    addTextNote,
    addColorItem,
    addIdeaItem,
    duplicateItem,
    duplicateSelectedItems,
    updateItemLocal,
    persistItemGeometry,
    updateTextContent,
    updateColorContent,
    updateIdeaContent,
    bringToFront,
    deleteItem,
    deleteSelectedItems,
    batchDeleteItems,
    addStrokeItem,
    alignSelectedItems,
    distributeSelectedItems,
    autoArrange,
    zoomIn,
    zoomOut,
    resetViewport,
    connections,
    selectedConnectionId,
    setSelectedConnectionId,
    addConnection,
    removeConnection,
    updateConnectionLabel,
    getConnectedReferenceIds,
  } = useMoodboard(projectId, initialItems, readOnly);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Pen / Eraser tool state
  const [activeTool, setActiveTool] = useState<'select' | 'pen' | 'eraser'>('select');
  const [penColor, setPenColor] = useState<string>('#D97706');
  const [penWidth, setPenWidth] = useState<number>(4);

  // Color Swatch Dialog state (react-colorful)
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [colorDialogProps, setColorDialogProps] = useState<{
    id?: string;
    hex: string;
    label: string;
    title: string;
    confirmLabel: string;
    isPen?: boolean;
  }>({
    hex: '#D97706',
    label: 'Primary Amber',
    title: 'Add Color Swatch',
    confirmLabel: 'Place Swatch',
  });

  // Creative Direction Links & Idea Promotion
  const {
    directionNotes,
    referenceCounts: referenceDirectionCounts,
    refetch: refetchDirectionNotes,
    promoteIdeaToDirection,
  } = useProjectDirectionLinks(projectId, readOnly);

  const [isDirectionInspectorOpen, setIsDirectionInspectorOpen] = useState(false);
  const [inspectedReference, setInspectedReference] = useState<Reference | null>(null);

  // Selected item type and reference counts
  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedId) || null;
  }, [items, selectedId]);

  const selectedItemType = selectedItem?.type;
  const selectedReferenceLinksCount = selectedItem?.reference_id
    ? referenceDirectionCounts.get(selectedItem.reference_id) || 0
    : 0;

  const handleInspectReference = useCallback(
    (referenceId: string) => {
      const itemWithRef = items.find((i) => i.reference_id === referenceId);
      if (itemWithRef?.reference) {
        setInspectedReference(itemWithRef.reference);
        setIsDirectionInspectorOpen(true);
      } else {
        referenceService
          .getReferenceById(referenceId)
          .then((ref) => {
            if (ref) {
              setInspectedReference(ref);
              setIsDirectionInspectorOpen(true);
            }
          })
          .catch((err) => {
            console.error('Failed to load reference for inspector:', err);
          });
      }
    },
    [items]
  );

  const handleOpenDirectionInspectorForSelected = useCallback(() => {
    if (selectedItem?.type === 'reference' && selectedItem.reference_id) {
      handleInspectReference(selectedItem.reference_id);
    }
  }, [selectedItem, handleInspectReference]);

  const handlePromoteIdea = useCallback(
    async (title: string, notes?: string, itemId?: string) => {
      try {
        const connectedRefIds = itemId ? getConnectedReferenceIds(itemId) : [];
        await promoteIdeaToDirection(title, notes, connectedRefIds);
        const count = connectedRefIds.length;
        setUploadStatus(
          count > 0
            ? `Promoted idea to Creative Direction (linked ${count} connected reference${count > 1 ? 's' : ''})`
            : 'Promoted idea to Creative Direction statement'
        );
        setTimeout(() => setUploadStatus(null), 3500);
      } catch (err: unknown) {
        console.error('Failed to promote idea:', err);
        const msg = err instanceof Error ? err.message : 'Failed to promote idea';
        setUploadError(msg);
        setTimeout(() => setUploadError(null), 5000);
      }
    },
    [promoteIdeaToDirection, getConnectedReferenceIds]
  );

  const handlePromoteSelectedIdea = useCallback(async () => {
    if (selectedItem?.type === 'idea') {
      const content = selectedItem.content as { title?: string; notes?: string };
      if (content?.title) {
        await handlePromoteIdea(content.title, content.notes, selectedItem.id);
      }
    }
  }, [selectedItem, handlePromoteIdea]);

  // Exporter reference
  const exportFnRef = useRef<((name?: string) => Promise<boolean>) | null>(null);

  // URL reference capture modal on canvas paste
  const [isAddRefOpen, setIsAddRefOpen] = useState(false);
  const [pendingRefUrl, setPendingRefUrl] = useState<string>('');

  const handleUndo = useCallback(async () => {
    await undo();
  }, [undo]);

  const handlePlaceReference = async (reference: Reference) => {
    try {
      await addReferenceItem(reference);
    } catch (err: unknown) {
      console.error('Failed to place reference:', err);
      const msg = err instanceof Error ? err.message : 'Failed to add reference to canvas';
      setUploadError(msg);
      setTimeout(() => setUploadError(null), 6000);
    }
  };

  const handleDropReference = async (rawReference: unknown, dropCoords: { x: number; y: number }) => {
    if (rawReference && typeof rawReference === 'object' && 'id' in rawReference) {
      try {
        await addReferenceItem(rawReference as Reference, dropCoords);
      } catch (err: unknown) {
        console.error('Failed to drop reference:', err);
        const msg = err instanceof Error ? err.message : 'Failed to add reference to canvas';
        setUploadError(msg);
        setTimeout(() => setUploadError(null), 6000);
      }
    }
  };

  const handleAddColor = () => {
    setColorDialogProps({
      hex: '#D97706',
      label: 'Primary Amber',
      title: 'Add Color Swatch',
      confirmLabel: 'Place Swatch',
      isPen: false,
    });
    setIsColorDialogOpen(true);
  };

  const handleOpenPenColorDialog = () => {
    setColorDialogProps({
      hex: penColor,
      label: 'Stroke Color',
      title: 'Pen Stroke Color',
      confirmLabel: 'Set Color',
      isPen: true,
    });
    setIsColorDialogOpen(true);
  };

  const handleConfirmColor = async (hex: string, label: string) => {
    try {
      if (colorDialogProps.isPen) {
        setPenColor(hex);
        return;
      }
      if (colorDialogProps.id) {
        updateColorContent(colorDialogProps.id, hex, label);
      } else {
        await addColorItem(hex, label);
      }
    } catch (err: unknown) {
      console.error('Failed to save color swatch:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save color swatch';
      setUploadError(msg);
      setTimeout(() => setUploadError(null), 6000);
    }
  };

  const handleAddIdea = async () => {
    try {
      await addIdeaItem('Creative Direction', 'Focus on warmth, restraint, and tactile typography');
    } catch (err: unknown) {
      console.error('Failed to add creative idea:', err);
      const msg = err instanceof Error ? err.message : 'Failed to add creative idea';
      setUploadError(msg);
      setTimeout(() => setUploadError(null), 6000);
    }
  };

  const handleAddTextNote = async () => {
    try {
      await addTextNote('Creative Note');
    } catch (err: unknown) {
      console.error('Failed to add text note:', err);
      const msg = err instanceof Error ? err.message : 'Failed to add text note';
      setUploadError(msg);
      setTimeout(() => setUploadError(null), 6000);
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
        const underlying =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null
              ? (err as { message?: string; error?: string }).message ||
                (err as { message?: string; error?: string }).error ||
                'Upload failed'
              : String(err);
        setUploadError(
          underlying.toLowerCase().startsWith('failed') || underlying.toLowerCase().startsWith('storage error')
            ? underlying
            : `Failed to upload image: ${underlying}`
        );
        setTimeout(() => setUploadError(null), 8000);
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

  // Global Clipboard paste listener (trimmed: text & URLs only, no image auto-upload)
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

      const pastedText = e.clipboardData?.getData('text/plain')?.trim();
      if (!pastedText) return;

      // If it's a URL -> trigger Reference Capture dialog
      if (/^https?:\/\//i.test(pastedText)) {
        e.preventDefault();
        setPendingRefUrl(pastedText);
        setIsAddRefOpen(true);
        return;
      }

      // Otherwise -> create Text note
      e.preventDefault();
      await addTextNote(pastedText);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [readOnly, isAddRefOpen, addTextNote]);

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
      <div className="flex-1 w-full h-[calc(100vh-56px)] min-h-[500px] flex flex-col items-center justify-center bg-[#121211] p-6 text-center">
        <p className="text-xs text-red-400 mb-3">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Reload Playground
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-[calc(100vh-56px)] min-h-[500px] overflow-hidden bg-[#121211]">
      {/* Uploading Status Banner */}
      {isUploading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 shadow-floating animate-in fade-in-50">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          <span className="text-xs font-medium text-foreground">{uploadStatus || 'Processing...'}</span>
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-lg flex items-center gap-2 rounded-lg border border-red-500/40 bg-[#1A1A19]/95 backdrop-blur px-3.5 py-2 shadow-floating animate-in fade-in-50 text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="text-xs font-medium flex-1">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="ml-2 text-xs text-muted-foreground hover:text-foreground underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Persistence Error Banner (No Silent Failures) */}
      {saveError && (
        <div className="absolute top-4 right-4 z-40 flex items-center gap-2.5 rounded-lg border border-red-500/40 bg-[#1A1A19]/95 backdrop-blur px-3.5 py-2 shadow-floating text-red-400 animate-in fade-in-50">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="text-xs font-medium">{saveError}</span>
          <button
            type="button"
            onClick={clearSaveError}
            className="ml-2 text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Save Status Pill (Quiet, restrained indicator) */}
      {saveStatus !== 'idle' && saveStatus !== 'error' && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 rounded-full border border-border/70 bg-[#1A1A19]/85 backdrop-blur px-3 py-1 text-[11px] text-muted-foreground select-none pointer-events-none transition-opacity duration-300">
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-accent" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-foreground/80">Saved</span>
            </>
          )}
        </div>
      )}

      {/* Dynamic Konva Stage */}
      <DynamicMoodboardStage
        items={items}
        selectedId={selectedId}
        selectedIds={selectedIds}
        viewport={viewport}
        readOnly={readOnly}
        activeTool={activeTool}
        penColor={penColor}
        penWidth={penWidth}
        onChangeActiveTool={setActiveTool}
        onAddStroke={addStrokeItem}
        onBatchDeleteStrokes={batchDeleteItems}
        connections={connections}
        selectedConnectionId={selectedConnectionId}
        onSelectConnection={setSelectedConnectionId}
        onAddConnection={addConnection}
        onDeleteConnection={removeConnection}
        onUpdateConnectionLabel={updateConnectionLabel}
        referenceDirectionCounts={referenceDirectionCounts}
        onInspectReferenceDirection={handleInspectReference}
        onPromoteIdeaToDirection={handlePromoteIdea}
        onViewportChange={setViewport}
        onSelectId={setSelectedId}
        onSelectIds={setSelectedIds}
        onToggleSelectId={toggleSelectedId}
        onDeleteSelected={deleteSelectedItems}
        onDuplicateSelected={duplicateSelectedItems}
        onNudgeSelected={nudgeSelectedItems}
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
        onUndo={handleUndo}
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
                  onClick={handleAddColor}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Palette className="h-3.5 w-3.5 text-accent" />
                  <span>Add Swatch</span>
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
        selectedCount={selectedIds.length}
        readOnly={readOnly}
        activeTool={activeTool}
        onTogglePenTool={() => setActiveTool((prev) => (prev === 'pen' ? 'select' : 'pen'))}
        onToggleEraserTool={() => setActiveTool((prev) => (prev === 'eraser' ? 'select' : 'eraser'))}
        penColor={penColor}
        onOpenPenColorPicker={handleOpenPenColorDialog}
        penWidth={penWidth}
        onChangePenWidth={setPenWidth}
        canUndo={canUndo}
        onUndo={handleUndo}
        isLibraryOpen={isLibraryOpen}
        onToggleLibrary={() => setIsLibraryOpen((prev) => !prev)}
        onUploadImageFile={(file) => handleUploadImageFile(file, file.name)}
        onAddTextNote={handleAddTextNote}
        onAddColor={handleAddColor}
        onAddIdea={handleAddIdea}
        onDuplicateSelected={duplicateSelectedItems}
        onDeleteSelected={deleteSelectedItems}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetViewport}
        onZoomToFit={() => zoomToFit()}
        onExportImage={() => exportFnRef.current?.(projectName || 'moodboard')}
        selectedItemType={selectedItemType}
        selectedReferenceLinksCount={selectedReferenceLinksCount}
        onOpenDirectionInspector={handleOpenDirectionInspectorForSelected}
        onPromoteSelectedIdea={handlePromoteSelectedIdea}
        onAlign={alignSelectedItems}
        onDistribute={distributeSelectedItems}
        onAutoArrange={autoArrange}
        selectedConnectionId={selectedConnectionId}
        onDeleteSelectedConnection={() => {
          if (selectedConnectionId) {
            removeConnection(selectedConnectionId);
          }
        }}
      />

      {!readOnly && (
        <>
          {/* Color Swatch Creation & Editing Dialog (react-colorful) */}
          <ColorSwatchDialog
            open={isColorDialogOpen}
            onOpenChange={setIsColorDialogOpen}
            initialHex={colorDialogProps.hex}
            initialLabel={colorDialogProps.label}
            title={colorDialogProps.title}
            confirmLabel={colorDialogProps.confirmLabel}
            onConfirm={handleConfirmColor}
          />

          {/* Reference Library Drawer */}
          <MoodboardLibraryDrawer
            projectId={projectId}
            isOpen={isLibraryOpen}
            onClose={() => setIsLibraryOpen(false)}
            onPlaceReference={handlePlaceReference}
          />

          {/* Creative Direction Inspector Drawer */}
          <CanvasDirectionInspector
            projectId={projectId}
            reference={inspectedReference}
            isOpen={isDirectionInspectorOpen}
            onClose={() => {
              setIsDirectionInspectorOpen(false);
              setInspectedReference(null);
            }}
            availableDirections={directionNotes}
            onDirectionsChanged={refetchDirectionNotes}
            onNavigateToDirection={onNavigateToDirection}
            readOnly={readOnly}
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
