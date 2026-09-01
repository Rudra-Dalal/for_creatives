'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { projectService } from '@/features/projects/services/projectService';
import type { Project } from '@/features/projects/types';
import { ReferenceLibrary } from '@/features/references/components/ReferenceLibrary';
import { MoodboardCanvas } from '@/features/moodboard/components/MoodboardCanvas';
import { DirectionNotesView } from '@/features/creative-direction/components/DirectionNotesView';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Globe, Shield, ArrowRight, Lock } from 'lucide-react';
import Link from 'next/link';

export default function SharedProjectPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === 'string' ? params.token : '';

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'references' | 'moodboard' | 'direction'>('references');

  useEffect(() => {
    async function loadSharedProject() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const found = await projectService.getProjectByShareToken(token);
        if (!found) {
          setError('This share link is inactive, revoked, or invalid.');
        } else {
          setProject(found);
        }
      } catch (err) {
        setError('Failed to load shared project');
      } finally {
        setIsLoading(false);
      }
    }

    loadSharedProject();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <LoadingSpinner label="Loading shared creative workspace..." />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <EmptyState
          icon={<Lock className="h-10 w-10 stroke-[1.25] text-muted-foreground" />}
          title="Share Link Unavailable"
          description={error || 'This project share link has either expired, been revoked by the owner, or is invalid.'}
          action={
            <Link href="/login">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <span>Go to Sign in</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Read-Only Shared Header */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur-none">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-display text-sm font-semibold tracking-tight text-foreground hover:text-accent transition-colors"
          >
            For Creatives
          </Link>

          <span className="text-border-strong">•</span>

          <h1 className="font-display text-sm font-medium text-foreground tracking-tight max-w-[200px] sm:max-w-md truncate">
            {project.name}
          </h1>

          <span className="hidden sm:inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] text-muted-foreground bg-surface border border-border">
            <Globe className="h-2.5 w-2.5 text-accent" />
            <span>Read-Only View</span>
          </span>
        </div>

        {/* Tab Navigation */}
        <nav className="hidden sm:flex items-center gap-1 rounded-md bg-surface p-1 border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('references')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'references'
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            References
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('moodboard')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'moodboard'
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Moodboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('direction')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'direction'
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Creative Direction
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
              <span>Sign In</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Project Banner */}
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
            ) : null}
          </div>

          {/* Mobile Tab Switcher */}
          <div className="sm:hidden flex items-center gap-1 rounded-md bg-surface p-1 border border-border mt-2">
            <button
              type="button"
              onClick={() => setActiveTab('references')}
              className={`flex-1 rounded py-1 text-xs font-medium text-center ${
                activeTab === 'references' ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              References
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('moodboard')}
              className={`flex-1 rounded py-1 text-xs font-medium text-center ${
                activeTab === 'moodboard' ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              Moodboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('direction')}
              className={`flex-1 rounded py-1 text-xs font-medium text-center ${
                activeTab === 'direction' ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              Direction
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'references' | 'moodboard' | 'direction')}
          className="flex-1 flex flex-col"
        >
          <TabsContent value="references" className="flex-1 flex flex-col mt-0">
            <ReferenceLibrary projectId={project.id} readOnly={true} />
          </TabsContent>

          <TabsContent value="moodboard" className="flex-1 flex flex-col mt-0">
            <MoodboardCanvas projectId={project.id} projectName={project.name} />
          </TabsContent>

          <TabsContent value="direction" className="flex-1 flex flex-col mt-0">
            <DirectionNotesView projectId={project.id} projectName={project.name} readOnly={true} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
