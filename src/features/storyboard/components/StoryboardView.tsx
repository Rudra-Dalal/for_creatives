'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useStoryboard } from '../hooks/useStoryboard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clapperboard, Plus } from 'lucide-react';

const DynamicStoryboardCanvas = dynamic(
  () => import('./StoryboardCanvas').then((mod) => mod.StoryboardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 w-full h-full flex items-center justify-center bg-[#121110]">
        <LoadingSpinner label="Initializing storyboard workspace..." />
      </div>
    ),
  }
);

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
    refresh,
    createScene,
    updateScene,
    deleteScene,
    createShot,
    updateShot,
    deleteShot,
    duplicateShot,
    reassignShotScene,
    batchUpdateShotPositions,
  } = useStoryboard(projectId);

  // Loading State
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-background">
        <LoadingSpinner label="Loading storyboard..." />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-background">
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

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-background">
      <DynamicStoryboardCanvas
        projectId={projectId}
        projectName={projectName}
        scenes={scenes}
        readOnly={readOnly}
        onCreateScene={createScene}
        onUpdateScene={updateScene}
        onDeleteScene={deleteScene}
        onCreateShot={createShot}
        onUpdateShot={updateShot}
        onDeleteShot={deleteShot}
        onDuplicateShot={duplicateShot}
        onReassignShotScene={reassignShotScene}
        onBatchUpdateShotPositions={batchUpdateShotPositions}
      />

      {/* Floating Onboarding Helper when canvas has 0 scenes */}
      {scenes.length === 0 && !readOnly && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border/80 bg-surface/90 backdrop-blur-md px-4 py-2.5 shadow-xl text-xs text-muted-foreground">
            <Clapperboard className="h-4 w-4 text-accent" />
            <span>
              Freeform canvas ready. Press <kbd className="font-mono px-1 py-0.5 rounded bg-surface-subtle border border-border text-foreground">C</kbd> or click <strong>Scene</strong> in the toolbar to establish a territory.
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => createScene('Scene 1')}
              className="h-7 text-xs gap-1 ml-2"
            >
              <Plus className="h-3 w-3" />
              <span>Create First Scene</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
