'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/features/projects/hooks/useProject';
import { ProjectHeader } from '@/features/projects/components/ProjectHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Bookmark, LayoutGrid, Compass, ArrowLeft } from 'lucide-react';

export default function ProjectWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? params.id : '';
  const { project, isLoading, error } = useProject(projectId);
  const [activeTab, setActiveTab] = useState<'references' | 'moodboard' | 'direction'>('references');

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
      />

      {/* Project Metadata Banner */}
      <div className="border-b border-border bg-surface-subtle px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
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

      {/* Tab Shell Content (Placeholders for Steps 3–5) */}
      <main className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'references' | 'moodboard' | 'direction')} className="flex-1 flex flex-col">
          {/* References Tab Placeholder */}
          <TabsContent value="references" className="flex-1 flex items-center justify-center p-8 mt-0">
            <EmptyState
              icon={<Bookmark className="h-10 w-10 stroke-[1.25]" />}
              title="References Library"
              description="Reference capture, URL scraping, tag filtering, and grid view will be implemented in Step 3."
            />
          </TabsContent>

          {/* Moodboard Tab Placeholder */}
          <TabsContent value="moodboard" className="flex-1 flex items-center justify-center p-8 mt-0">
            <EmptyState
              icon={<LayoutGrid className="h-10 w-10 stroke-[1.25]" />}
              title="Moodboard Canvas"
              description="React-Konva spatial canvas, pan/zoom, drag-and-drop, and layout persistence will be implemented in Step 5."
            />
          </TabsContent>

          {/* Creative Direction Tab Placeholder */}
          <TabsContent value="direction" className="flex-1 flex items-center justify-center p-8 mt-0">
            <EmptyState
              icon={<Compass className="h-10 w-10 stroke-[1.25]" />}
              title="Creative Direction"
              description="Creative direction notes and bidirectional reference linking will be implemented in Step 4."
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
