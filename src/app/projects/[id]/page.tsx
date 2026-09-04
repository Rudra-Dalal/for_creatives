'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/features/projects/hooks/useProject';
import { ProjectHeader } from '@/features/projects/components/ProjectHeader';
import { CommandPalette } from '@/features/projects/components/CommandPalette';
import { TrashModal } from '@/features/projects/components/TrashModal';
import { ShareProjectModal } from '@/features/projects/components/ShareProjectModal';
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

type TabType = 'references' | 'moodboard' | 'direction';

function isValidTab(val: unknown): val is TabType {
  return val === 'references' || val === 'moodboard' || val === 'direction';
}

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? params.id : '';
  const { project, isLoading, error } = useProject(projectId);

  // Initialize activeTab from URL search param or localStorage
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const urlTab = new URLSearchParams(window.location.search).get('tab');
      if (isValidTab(urlTab)) return urlTab;
      if (projectId) {
        const savedTab = localStorage.getItem(`project_tab_${projectId}`);
        if (isValidTab(savedTab)) return savedTab;
      }
    }
    return 'references';
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // Tab change handler that keeps URL query param and localStorage synchronized
  const handleTabChange = useCallback(
    (newTab: TabType) => {
      setActiveTab(newTab);
      if (typeof window !== 'undefined') {
        if (projectId) {
          localStorage.setItem(`project_tab_${projectId}`, newTab);
        }
        const url = new URL(window.location.href);
        url.searchParams.set('tab', newTab);
        window.history.replaceState(null, '', url.toString());
      }
    },
    [projectId]
  );

  // Sync tab from URL or localStorage on mount/navigation
  useEffect(() => {
    if (typeof window === 'undefined' || !projectId) return;

    const syncTabFromUrlOrStorage = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = urlParams.get('tab');
      if (isValidTab(urlTab)) {
        setActiveTab(urlTab);
        localStorage.setItem(`project_tab_${projectId}`, urlTab);
      } else {
        const savedTab = localStorage.getItem(`project_tab_${projectId}`);
        if (isValidTab(savedTab)) {
          setActiveTab(savedTab);
          const url = new URL(window.location.href);
          url.searchParams.set('tab', savedTab);
          window.history.replaceState(null, '', url.toString());
        }
      }
    };

    syncTabFromUrlOrStorage();

    window.addEventListener('popstate', syncTabFromUrlOrStorage);
    return () => window.removeEventListener('popstate', syncTabFromUrlOrStorage);
  }, [projectId]);

  // Command Palette & Modal States
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
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
        onTabChange={(tab) => handleTabChange(tab as TabType)}
        onItemRestored={handleItemRestored}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenTrash={() => setIsTrashOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
      />

      {/* Project Description (shown only when description exists and not on moodboard) */}
      {activeTab !== 'moodboard' && project.description && (
        <div className="border-b border-border bg-surface-subtle px-6 py-2.5">
          <div className="max-w-7xl mx-auto">
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              {project.description}
            </p>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <main className="flex-1 flex flex-col">
        <Tabs
          value={activeTab}
          onValueChange={(v) => handleTabChange(v as TabType)}
          className="flex-1 flex flex-col"
        >
          {/* References Tab: Fully Functional Library */}
          <TabsContent value="references" className="flex-1 flex flex-col mt-0">
            <ReferenceLibrary key={`refs-${refreshKey}`} projectId={project.id} />
          </TabsContent>

          {/* Moodboard Tab: Full Spatial Konva Canvas */}
          <TabsContent value="moodboard" className="flex-1 flex flex-col mt-0">
            <MoodboardCanvas key={`mb-${refreshKey}`} projectId={project.id} projectName={project.name} />
          </TabsContent>

          {/* Creative Direction Tab: Fully Functional Statements & Bidirectional Links */}
          <TabsContent value="direction" className="flex-1 flex flex-col mt-0">
            <DirectionNotesView key={`dir-${refreshKey}`} projectId={project.id} projectName={project.name} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => handleTabChange(tab)}
        onAddReference={() => setIsAddRefOpen(true)}
        onOpenTrash={() => setIsTrashOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
      />

      {/* Global Trash Modal */}
      <TrashModal
        projectId={project.id}
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onItemRestored={handleItemRestored}
      />

      {/* Share Project Modal */}
      <ShareProjectModal
        project={project}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
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
