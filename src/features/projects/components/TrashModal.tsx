'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Bookmark,
  Compass,
  LayoutGrid,
} from 'lucide-react';
import { referenceService } from '@/features/references/services/referenceService';
import { moodboardService } from '@/features/moodboard/services/moodboardService';
import { directionService } from '@/features/creative-direction/services/directionService';
import type { Reference } from '@/features/references/types';
import type { MoodboardItem } from '@/features/moodboard/types';
import type { DirectionNoteWithReferences } from '@/features/creative-direction/types';

interface TrashModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onItemRestored?: () => void;
}

export function TrashModal({
  projectId,
  isOpen,
  onClose,
  onItemRestored,
}: TrashModalProps) {
  const [activeTab, setActiveTab] = useState<'references' | 'notes' | 'moodboard'>('references');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [references, setReferences] = useState<Reference[]>([]);
  const [notes, setNotes] = useState<DirectionNoteWithReferences[]>([]);
  const [moodboardItems, setMoodboardItems] = useState<MoodboardItem[]>([]);

  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [refs, dirNotes, mbItems] = await Promise.all([
        referenceService.getTrashReferences(projectId),
        directionService.getTrashNotes(projectId),
        moodboardService.getTrashItems(projectId),
      ]);
      setReferences(refs);
      setNotes(dirNotes);
      setMoodboardItems(mbItems);
    } catch {
      setError("Couldn't load trash items. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchTrash();
      setConfirmDeleteId(null);
    }
  }, [isOpen, fetchTrash]);

  const handleRestoreReference = async (id: string) => {
    setActionId(id);
    try {
      await referenceService.restoreReference(id);
      setReferences((prev) => prev.filter((r) => r.id !== id));
      onItemRestored?.();
    } catch {
      setError("Couldn't restore this reference. Please try again.");
    } finally {
      setActionId(null);
    }
  };

  const handlePermanentDeleteReference = async (id: string) => {
    setActionId(id);
    try {
      await referenceService.permanentlyDeleteReference(id);
      setReferences((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
      onItemRestored?.();
    } catch {
      setError("Couldn't permanently delete this reference.");
    } finally {
      setActionId(null);
    }
  };

  const handleRestoreNote = async (id: string) => {
    setActionId(id);
    try {
      await directionService.restoreDirectionNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      onItemRestored?.();
    } catch {
      setError("Couldn't restore this direction note.");
    } finally {
      setActionId(null);
    }
  };

  const handlePermanentDeleteNote = async (id: string) => {
    setActionId(id);
    try {
      await directionService.permanentlyDeleteDirectionNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setConfirmDeleteId(null);
      onItemRestored?.();
    } catch {
      setError("Couldn't permanently delete this direction note.");
    } finally {
      setActionId(null);
    }
  };

  const handleRestoreItem = async (id: string) => {
    setActionId(id);
    try {
      await moodboardService.restoreItem(id);
      setMoodboardItems((prev) => prev.filter((m) => m.id !== id));
      onItemRestored?.();
    } catch {
      setError("Couldn't restore this moodboard item.");
    } finally {
      setActionId(null);
    }
  };

  const handlePermanentDeleteItem = async (id: string) => {
    setActionId(id);
    try {
      await moodboardService.permanentlyDeleteItem(id);
      setMoodboardItems((prev) => prev.filter((m) => m.id !== id));
      setConfirmDeleteId(null);
      onItemRestored?.();
    } catch {
      setError("Couldn't permanently delete this moodboard item.");
    } finally {
      setActionId(null);
    }
  };

  const formatDeletedAt = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const totalCount = references.length + notes.length + moodboardItems.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-muted-foreground" />
            <DialogTitle className="text-base font-medium">Trash</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Soft-deleted items remain here. You can restore them at any time or permanently delete them.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <LoadingSpinner label="Loading trash..." />
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as typeof activeTab)}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid grid-cols-3 bg-surface border border-border w-full">
              <TabsTrigger value="references" className="text-xs gap-1.5">
                <Bookmark className="h-3.5 w-3.5" />
                <span>References ({references.length})</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs gap-1.5">
                <Compass className="h-3.5 w-3.5" />
                <span>Direction ({notes.length})</span>
              </TabsTrigger>
              <TabsTrigger value="moodboard" className="text-xs gap-1.5">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Moodboard ({moodboardItems.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* References Tab */}
            <TabsContent value="references" className="flex-1 overflow-y-auto mt-3 pr-1 space-y-2 max-h-[46vh]">
              {references.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No deleted references.
                </div>
              ) : (
                references.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-surface-subtle"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{ref.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="truncate max-w-[200px]">{ref.source_domain || ref.url}</span>
                        {ref.deleted_at && (
                          <span>• Deleted {formatDeletedAt(ref.deleted_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {confirmDeleteId === ref.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="danger"
                            size="sm"
                            className="h-7 text-xs px-2"
                            disabled={actionId === ref.id}
                            onClick={() => handlePermanentDeleteReference(ref.id)}
                          >
                            Confirm Delete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs gap-1 px-2.5"
                            disabled={actionId === ref.id}
                            onClick={() => handleRestoreReference(ref.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Restore</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                            disabled={actionId === ref.id}
                            onClick={() => setConfirmDeleteId(ref.id)}
                            title="Delete Permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Direction Notes Tab */}
            <TabsContent value="notes" className="flex-1 overflow-y-auto mt-3 pr-1 space-y-2 max-h-[46vh]">
              {notes.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No deleted direction notes.
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-surface-subtle"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{note.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{note.references?.length || 0} linked references preserved</span>
                        {note.deleted_at && (
                          <span>• Deleted {formatDeletedAt(note.deleted_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {confirmDeleteId === note.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="danger"
                            size="sm"
                            className="h-7 text-xs px-2"
                            disabled={actionId === note.id}
                            onClick={() => handlePermanentDeleteNote(note.id)}
                          >
                            Confirm Delete
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs gap-1 px-2.5"
                            disabled={actionId === note.id}
                            onClick={() => handleRestoreNote(note.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Restore</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                            disabled={actionId === note.id}
                            onClick={() => setConfirmDeleteId(note.id)}
                            title="Delete Permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Moodboard Items Tab */}
            <TabsContent value="moodboard" className="flex-1 overflow-y-auto mt-3 pr-1 space-y-2 max-h-[46vh]">
              {moodboardItems.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No deleted moodboard items.
                </div>
              ) : (
                moodboardItems.map((item) => {
                  let title = item.type.toUpperCase();
                  if (item.type === 'idea') {
                    title = (item.content as { title?: string })?.title || 'Idea Note';
                  } else if (item.type === 'text') {
                    title = (item.content as { text?: string })?.text || 'Text Card';
                  } else if (item.type === 'reference') {
                    title = item.reference?.title || (item.content as { title?: string })?.title || 'Reference Card';
                  } else if (item.type === 'color') {
                    title = `Color: ${(item.content as { hex?: string })?.hex || 'Swatch'}`;
                  } else if (item.type === 'image') {
                    title = (item.content as { fileName?: string })?.fileName || 'Canvas Image';
                  } else if (item.type === 'stroke') {
                    const strokeColor = (item.content as { color?: string })?.color || '#D97706';
                    title = `Drawing / Scribble (${strokeColor})`;
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-surface-subtle"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                            {item.type}
                          </span>
                          <p className="text-xs font-medium text-foreground truncate">{title}</p>
                        </div>
                        {item.deleted_at && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Deleted {formatDeletedAt(item.deleted_at)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {confirmDeleteId === item.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="danger"
                              size="sm"
                              className="h-7 text-xs px-2"
                              disabled={actionId === item.id}
                              onClick={() => handlePermanentDeleteItem(item.id)}
                            >
                              Confirm Delete
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 text-xs gap-1 px-2.5"
                              disabled={actionId === item.id}
                              onClick={() => handleRestoreItem(item.id)}
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Restore</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
                              disabled={actionId === item.id}
                              onClick={() => setConfirmDeleteId(item.id)}
                              title="Delete Permanently"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
          <span>{totalCount} total item{totalCount === 1 ? '' : 's'} in trash</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
