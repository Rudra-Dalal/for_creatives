'use client';

import React, { useState, useEffect } from 'react';
import type { StoryboardSceneWithShots } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Trash2, Plus, Clapperboard } from 'lucide-react';

export interface StoryboardSceneInspectorProps {
  scene: StoryboardSceneWithShots | null;
  readOnly?: boolean;
  onClose: () => void;
  onUpdateScene: (sceneId: string, updates: { title?: string; description?: string }) => Promise<void>;
  onDeleteScene: (sceneId: string) => Promise<void>;
  onAddShotToScene: (sceneId: string) => Promise<void>;
}

export function StoryboardSceneInspector({
  scene,
  readOnly = false,
  onClose,
  onUpdateScene,
  onDeleteScene,
  onAddShotToScene,
}: StoryboardSceneInspectorProps) {
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (scene) {
      setTitle(scene.title || '');
      setDescription(scene.description || '');
    }
  }, [scene]);

  if (!scene) return null;

  const sceneNumber = `SCENE ${String(scene.display_order + 1).padStart(2, '0')}`;

  const handleTitleBlur = async () => {
    if (title !== (scene.title || '') && !readOnly) {
      setIsSaving(true);
      try {
        await onUpdateScene(scene.id, { title: title.trim() });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDescriptionBlur = async () => {
    if (description !== (scene.description || '') && !readOnly) {
      setIsSaving(true);
      try {
        await onUpdateScene(scene.id, { description: description.trim() });
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <aside
      aria-label="Scene Territory Inspector"
      className="absolute top-16 right-6 w-80 z-30 rounded-xl border border-border/80 bg-[#161513]/95 backdrop-blur-md shadow-2xl p-4 text-foreground flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-accent px-1.5 py-0.5 rounded bg-surface border border-border">
            {sceneNumber}
          </span>
          <span className="text-xs text-muted-foreground">Territory</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-surface"
          aria-label="Close Inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Scene Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="e.g. Scene 1 - Intro Sequence"
          disabled={readOnly}
          className="h-8 text-xs bg-surface/80 border-border"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Setting / Summary
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="Location, atmosphere, tone notes..."
          rows={3}
          disabled={readOnly}
          className="text-xs bg-surface/80 border-border resize-none"
        />
      </div>

      {/* Member Shots Stats */}
      <div className="p-2.5 rounded-lg bg-surface/50 border border-border/60 flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Clapperboard className="h-3.5 w-3.5 text-accent" />
          Member Shots
        </span>
        <span className="font-mono font-medium text-foreground">
          {scene.shots.length} shots
        </span>
      </div>

      {/* Add Shot to Scene button */}
      {!readOnly && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onAddShotToScene(scene.id)}
          className="w-full h-8 text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Shot to this Scene
        </Button>
      )}

      {/* Footer Actions */}
      {!readOnly && (
        <div className="pt-2 border-t border-border/40 flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDeleteScene(scene.id)}
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Scene
          </Button>
        </div>
      )}
    </aside>
  );
}
