'use client';

import React, { useState, useEffect } from 'react';
import type {
  StoryboardShotWithLinks,
  StoryboardShot,
  StoryboardSceneWithShots,
  AspectRatio,
  ShotType,
  CameraMovement,
} from '../types';
import {
  ASPECT_RATIOS,
  SHOT_TYPES,
  SHOT_TYPE_LABELS,
  CAMERA_MOVEMENTS,
  CAMERA_MOVEMENT_LABELS,
} from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  X,
  Copy,
  Trash2,
  FolderInput,
  Ratio,
  Camera,
  Film,
} from 'lucide-react';

export interface StoryboardShotInspectorProps {
  shot: StoryboardShotWithLinks | null;
  scenes: StoryboardSceneWithShots[];
  readOnly?: boolean;
  onClose: () => void;
  onUpdateShot: (shotId: string, updates: Partial<StoryboardShot>) => Promise<void>;
  onReassignScene: (shotId: string, targetSceneId: string) => Promise<void>;
  onDuplicateShot: (shotId: string) => Promise<void>;
  onDeleteShot: (shotId: string) => Promise<void>;
}

export function StoryboardShotInspector({
  shot,
  scenes,
  readOnly = false,
  onClose,
  onUpdateShot,
  onReassignScene,
  onDuplicateShot,
  onDeleteShot,
}: StoryboardShotInspectorProps) {
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [shotType, setShotType] = useState<ShotType | ''>('');
  const [cameraMovement, setCameraMovement] = useState<CameraMovement | ''>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (shot) {
      setTitle(shot.title || '');
      setDescription(shot.description || '');
      setAspectRatio(shot.aspect_ratio || '16:9');
      setShotType((shot.shot_type as ShotType) || '');
      setCameraMovement((shot.camera_movement as CameraMovement) || '');
    }
  }, [shot]);

  if (!shot) return null;

  const currentScene = scenes.find((s) => s.id === shot.scene_id);
  const shotNumber = shot.shot_number || String(shot.display_order + 1);

  const handleTitleBlur = async () => {
    if (title !== (shot.title || '') && !readOnly) {
      setIsSaving(true);
      try {
        await onUpdateShot(shot.id, { title: title.trim() });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleDescriptionBlur = async () => {
    if (description !== (shot.description || '') && !readOnly) {
      setIsSaving(true);
      try {
        await onUpdateShot(shot.id, { description: description.trim() });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAspectRatioChange = async (ratio: AspectRatio) => {
    if (ratio !== shot.aspect_ratio && !readOnly) {
      setAspectRatio(ratio);
      await onUpdateShot(shot.id, { aspect_ratio: ratio });
    }
  };

  const handleSceneChange = async (targetSceneId: string) => {
    if (targetSceneId !== shot.scene_id && !readOnly) {
      setIsSaving(true);
      try {
        await onReassignScene(shot.id, targetSceneId);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleShotTypeChange = async (val: string) => {
    const st = val ? (val as ShotType) : null;
    setShotType(st || '');
    if (!readOnly) {
      await onUpdateShot(shot.id, { shot_type: st });
    }
  };

  const handleCameraMovementChange = async (val: string) => {
    const cm = val ? (val as CameraMovement) : null;
    setCameraMovement(cm || '');
    if (!readOnly) {
      await onUpdateShot(shot.id, { camera_movement: cm });
    }
  };

  return (
    <aside
      aria-label="Shot Inspector"
      className="absolute top-16 right-6 w-84 z-30 rounded-xl border border-border/80 bg-[#161513]/95 backdrop-blur-md shadow-2xl p-4 text-foreground flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-accent px-1.5 py-0.5 rounded bg-surface border border-border">
            SHOT {shotNumber.padStart(2, '0')}
          </span>
          <span className="text-xs text-muted-foreground">Inspector</span>
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
          Shot Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="e.g. Wide establishing shot"
          disabled={readOnly}
          className="h-8 text-xs bg-surface/80 border-border"
        />
      </div>

      {/* Deliberate Scene Reassignment */}
      <div className="space-y-1.5 p-2.5 rounded-lg bg-surface/50 border border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
            <FolderInput className="h-3.5 w-3.5 text-accent" />
            Scene Territory
          </span>
          <span className="text-[10px] text-muted-foreground">
            Deliberate Reparenting
          </span>
        </div>
        <select
          value={shot.scene_id}
          onChange={(e) => handleSceneChange(e.target.value)}
          disabled={readOnly || isSaving}
          className="w-full text-xs rounded bg-surface border border-border p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {scenes.map((s) => (
            <option key={s.id} value={s.id}>
              Scene {s.display_order + 1}: {s.title}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground italic">
          Normal dragging keeps the shot assigned to{' '}
          <strong>{currentScene?.title || 'its scene'}</strong>.
        </p>
      </div>

      {/* Aspect Ratio Switcher */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Ratio className="h-3.5 w-3.5" />
          Aspect Ratio
        </label>
        <div className="grid grid-cols-4 gap-1">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              disabled={readOnly}
              onClick={() => handleAspectRatioChange(ratio)}
              className={`text-[11px] py-1 px-2 rounded border font-mono transition-all ${
                aspectRatio === ratio
                  ? 'bg-accent/20 border-accent text-accent font-semibold'
                  : 'bg-surface/50 border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Lightweight Metadata: Shot Type & Camera Movement */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            <Film className="h-3 w-3" />
            Framing
          </label>
          <select
            value={shotType}
            onChange={(e) => handleShotTypeChange(e.target.value)}
            disabled={readOnly}
            className="w-full text-[11px] rounded bg-surface border border-border p-1 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">None</option>
            {SHOT_TYPES.map((st) => (
              <option key={st} value={st}>
                {SHOT_TYPE_LABELS[st]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            <Camera className="h-3 w-3" />
            Movement
          </label>
          <select
            value={cameraMovement}
            onChange={(e) => handleCameraMovementChange(e.target.value)}
            disabled={readOnly}
            className="w-full text-[11px] rounded bg-surface border border-border p-1 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">None</option>
            {CAMERA_MOVEMENTS.map((cm) => (
              <option key={cm} value={cm}>
                {CAMERA_MOVEMENT_LABELS[cm]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Action / Notes
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="Brief description of action, subject, or lighting..."
          rows={2}
          disabled={readOnly}
          className="text-xs bg-surface/80 border-border resize-none"
        />
      </div>

      {/* Footer Actions */}
      {!readOnly && (
        <div className="pt-2 border-t border-border/40 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDuplicateShot(shot.id)}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDeleteShot(shot.id)}
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}
    </aside>
  );
}
