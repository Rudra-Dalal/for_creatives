'use client';

import React, { useState } from 'react';
import { useStoryboard } from '../hooks/useStoryboard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Clapperboard, Plus, RefreshCw, Film, Sparkles, Layers } from 'lucide-react';
import { DEFAULT_ASPECT_RATIO } from '../types';

interface StoryboardViewProps {
  projectId: string;
  projectName?: string;
  readOnly?: boolean;
}

export function StoryboardView({
  projectId,
  projectName = 'Storyboard',
  readOnly = false,
}: StoryboardViewProps) {
  const {
    scenes,
    isLoading,
    error,
    totalShotsCount,
    refresh,
    createScene,
    createShot,
  } = useStoryboard(projectId);

  const [isCreatingScene, setIsCreatingScene] = useState(false);

  const handleCreateScene = async () => {
    if (readOnly || isCreatingScene) return;
    setIsCreatingScene(true);
    try {
      const nextSceneNumber = scenes.length + 1;
      await createScene(`Scene ${nextSceneNumber}`);
    } finally {
      setIsCreatingScene(false);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <LoadingSpinner label="Loading storyboard..." />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 max-w-md space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      </div>
    );
  }

  // Empty State
  if (scenes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <EmptyState
          icon={<Clapperboard className="h-8 w-8" />}
          title="No Storyboard Scenes Yet"
          description="Create your first scene to begin sequencing shots, assigning visuals, and structuring your narrative."
          action={
            !readOnly ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleCreateScene}
                disabled={isCreatingScene}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create First Scene</span>
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  // Storyboard Shell View
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Subheader / Storyboard Toolbar Shell */}
      <div className="border-b border-border bg-surface px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-accent" />
              <h2 className="font-display text-sm font-medium text-foreground tracking-tight">
                {projectName}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">
                {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
              </span>
              <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border">
                {totalShotsCount} {totalShotsCount === 1 ? 'shot' : 'shots'}
              </span>
              <span className="bg-surface-subtle px-2 py-0.5 rounded border border-border text-foreground font-medium">
                {DEFAULT_ASPECT_RATIO}
              </span>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCreateScene}
                disabled={isCreatingScene}
                className="gap-1.5 text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Scene</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area: Scenes & Shots Container */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {scenes.map((scene, sceneIndex) => (
            <section
              key={scene.id}
              className="rounded-lg border border-border bg-surface/60 overflow-hidden transition-colors hover:border-border-strong"
            >
              {/* Scene Header */}
              <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                    SC {String(sceneIndex + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-sm font-medium text-foreground">
                    {scene.title}
                  </h3>
                  {scene.description && (
                    <p className="text-xs text-muted-foreground hidden sm:inline truncate max-w-md">
                      — {scene.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {scene.shots.length} {scene.shots.length === 1 ? 'shot' : 'shots'}
                  </span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => createShot(scene.id)}
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Shot</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Scene Body / Shot Sequence */}
              <div className="p-5">
                {scene.shots.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/80 bg-surface-subtle/40 p-8 text-center space-y-2">
                    <Layers className="h-5 w-5 mx-auto text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">
                      No shots in this scene yet.
                    </p>
                    {!readOnly && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => createShot(scene.id)}
                        className="h-7 text-xs gap-1 mt-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add First Shot</span>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {scene.shots.map((shot, shotIndex) => (
                      <div
                        key={shot.id}
                        className="group rounded-md border border-border bg-surface-subtle overflow-hidden flex flex-col transition-all hover:border-border-strong hover:shadow-sm"
                      >
                        {/* 16:9 Visual Frame Placeholder */}
                        <div className="relative aspect-video w-full bg-background/70 border-b border-border flex items-center justify-center overflow-hidden">
                          {shot.visual_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={shot.visual_url}
                              alt={shot.title || `Shot ${shotIndex + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-3 text-muted-foreground/50 flex flex-col items-center gap-1">
                              <Sparkles className="h-4 w-4" />
                              <span className="text-[10px] font-mono">Frame {shotIndex + 1}</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2 font-mono text-[10px] bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border text-foreground/80">
                            SH {String(shotIndex + 1).padStart(2, '0')}
                          </div>
                        </div>

                        {/* Shot Description */}
                        <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                          <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">
                            {shot.description || <span className="italic text-muted-foreground">No description</span>}
                          </p>
                          {shot.dialogue && (
                            <p className="text-[11px] text-muted-foreground/80 italic line-clamp-1 border-l-2 border-accent/40 pl-2">
                              &ldquo;{shot.dialogue}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
