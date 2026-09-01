'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/features/projects/hooks/useProject';
import { ProjectHeader } from '@/features/projects/components/ProjectHeader';
import { CommandPalette } from '@/features/projects/components/CommandPalette';
import { TrashModal } from '@/features/projects/components/TrashModal';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';

import { ReferenceLibrary } from '@/features/references/components/ReferenceLibrary';
import { DirectionNotesView } from '@/features/creative-direction/components/DirectionNotesView';
import { MoodboardCanvas } from '@/features/moodboard/components/MoodboardCanvas';
import { AddReferenceDialog } from '@/features/references/components/AddReferenceDialog';
import { referenceService } from '@/features/references/services/referenceService';
import type { CreateReferenceInput } from '@/features/references/validation/referenceSchema';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? params.id : '';
  const { project, isLoading, error } = useProject(projectId);
  const [activeTab, setActiveTab] = useState<'references' | 'moodboard' | 'direction'>('references');
  const [refreshKey, setRefreshKey] = useState(0);

  // Command Palette & Modal States
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isAddRefOpen, setIsAddRefOpen] = useState(false);

  // Global Cmd/Ctrl+K keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const active = document.activeElement;
        if (
          !isCommandPaletteOpen &&
          (active?.tagName === 'INPUT' ||
            active?.tagName === 'TEXTAREA' ||
            (active as HTMLElement)?.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen]);

  const handleItemRestored = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleCreateReferenceSubmit = async (input: CreateReferenceInput) => {
    const created = await referenceService.createReference({
      projectId: input.projectId,
      url: input.url,
      title: input.title,
      thumbnailUrl: input.thumbnailUrl,
      sourceDomain: input.sourceDomain,
      note: input.note,
      tags: input.tags,
    });
    setRefreshKey((prev) => prev + 1);
    setIsAddRefOpen(false);
    return created;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <LoadingSpinner label="Loading workspace..." />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <EmptyState
          title="Project Not Found"
          description="The requested project workspace could not be found or you do not have permission to view it."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Workspace Header */}
      <ProjectHeader
        project={project}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'references' | 'moodboard' | 'direction')}
        onItemRestored={handleItemRestored}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenTrash={() => setIsTrashOpen(true)}
      />

      {/* Project Metadata Banner */}
      <div className="border-b border-border bg-surface-subtle px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-medium tracking-tight text-foreground">
              {project.name}
            </h2>
            {project.description ? (
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                No description provided.
              </p>
            )}
          </div>

          {/* Mobile Tab Switcher */}
          <div className="sm:hidden flex items-center gap-1 rounded-md bg-surface p-1 border border-border mt-2">
            <button
              type="button"
              onClick={() => setActiveTab('references')}
              className={`flex-1 rounded py-1 text-xs font-medium text-center ${
                activeTab === 'references'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              References
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('moodboard')}
              className={`flex-1 rounded py-1 text-xs font-medium text-center ${
                activeTab === 'moodboard'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              Moodboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('direction')}
              className={`flex-1 rounded py-1 text-xs font-medium text-center ${
                activeTab === 'direction'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              Direction
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className="flex-1 flex flex-col">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'references' | 'moodboard' | 'direction')}
          className="flex-1 flex flex-col"
        >
          {/* References Tab: Fully Functional Library */}
          <TabsContent value="references" className="flex-1 flex flex-col mt-0">
            <ReferenceLibrary key={`refs-${refreshKey}`} projectId={project.id} />
          </TabsContent>

          {/* Moodboard Tab: Full Spatial Konva Canvas */}
          <TabsContent value="moodboard" className="flex-1 flex flex-col mt-0">
            <MoodboardCanvas key={`mb-${refreshKey}`} projectId={project.id} />
          </TabsContent>

          {/* Creative Direction Tab: Fully Functional Statements & Bidirectional Links */}
          <TabsContent value="direction" className="flex-1 flex flex-col mt-0">
            <DirectionNotesView key={`dir-${refreshKey}`} projectId={project.id} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
        onAddReference={() => setIsAddRefOpen(true)}
        onOpenTrash={() => setIsTrashOpen(true)}
      />

      {/* Global Trash Modal */}
      <TrashModal
        projectId={project.id}
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onItemRestored={handleItemRestored}
      />

      {/* Add Reference Dialog */}
      {isAddRefOpen && (
        <AddReferenceDialog
          projectId={project.id}
          open={isAddRefOpen}
          onOpenChange={(open) => setIsAddRefOpen(open)}
          onReferenceCreated={() => {
            setRefreshKey((prev) => prev + 1);
            setIsAddRefOpen(false);
          }}
          onSubmit={handleCreateReferenceSubmit}
        />
      )}
    </div>
  );
}
