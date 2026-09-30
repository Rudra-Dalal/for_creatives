import React, { useState, useEffect, useRef } from 'react';
import type {
  StoryboardShotWithLinks,
  StoryboardShot,
  StoryboardSceneWithShots,
  AspectRatio,
  ShotType,
  CameraMovement,
  ShotVisualSource,
} from '../types';
import type { Reference } from '@/features/references/types';
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
  Image as ImageIcon,
  Upload,
  Link2,
  Check,
  Loader2,
} from 'lucide-react';
import { shotHasVisualFrame, getShotFrameImageUrl } from '../utils/shotFrameUtils';
import { thumbnailService } from '@/features/references/services/thumbnailService';

export interface StoryboardShotInspectorProps {
  shot: StoryboardShotWithLinks | null;
  scenes: StoryboardSceneWithShots[];
  projectId?: string;
  readOnly?: boolean;
  onClose: () => void;
  onUpdateShot: (shotId: string, updates: Partial<StoryboardShot>) => Promise<void>;
  onUpdateVisualFrame?: (
    shotId: string,
    visualUrl: string,
    visualSource: ShotVisualSource
  ) => Promise<void>;
  onReassignScene: (shotId: string, targetSceneId: string) => Promise<void>;
  onDuplicateShot: (shotId: string) => Promise<void>;
  onDeleteShot: (shotId: string) => Promise<void>;
}

export function StoryboardShotInspector({
  shot,
  scenes,
  projectId,
  readOnly = false,
  onClose,
  onUpdateShot,
  onUpdateVisualFrame,
  onReassignScene,
  onDuplicateShot,
  onDeleteShot,
}: StoryboardShotInspectorProps) {
  const [title, setTitle] = useState<string>(shot?.title || '');
  const [description, setDescription] = useState<string>(shot?.description || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(shot?.aspect_ratio || '16:9');
  const [shotType, setShotType] = useState<ShotType | ''>((shot?.shot_type as ShotType) || '');
  const [cameraMovement, setCameraMovement] = useState<CameraMovement | ''>(
    (shot?.camera_movement as CameraMovement) || ''
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isAssigningRef, setIsAssigningRef] = useState<boolean>(false);
  const [frameError, setFrameError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpdateFrame = async (url: string, source: ShotVisualSource) => {
    if (readOnly || !shot) return;
    setFrameError(null);
    try {
      if (onUpdateVisualFrame) {
        await onUpdateVisualFrame(shot.id, url, source);
      } else {
        await onUpdateShot(shot.id, { visual_url: url, visual_source: source });
      }
    } catch (err) {
      console.error('Failed to update shot visual frame:', err);
      setFrameError(err instanceof Error ? err.message : 'Failed to update frame');
      throw err;
    }
  };

  const handleAssignReference = async (ref: Reference) => {
    if (readOnly || !shot || isAssigningRef || isUploading || isClearing) return;
    if (!ref.thumbnail_url) {
      setFrameError('Selected reference does not have a thumbnail image.');
      return;
    }
    setIsAssigningRef(true);
    setFrameError(null);
    try {
      await handleUpdateFrame(ref.thumbnail_url, 'reference');
    } catch (err) {
      // error handled in handleUpdateFrame
    } finally {
      setIsAssigningRef(false);
    }
  };

  const handleUploadClick = () => {
    if (readOnly || isUploading || isClearing || isAssigningRef) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || !shot) return;
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFrameError('Please select a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }

    const effectiveProjectId = projectId || shot.project_id;
    if (!effectiveProjectId) {
      setFrameError('Project ID is missing. Cannot upload frame image.');
      return;
    }

    setIsUploading(true);
    setFrameError(null);
    try {
      const publicUrl = await thumbnailService.uploadThumbnail(effectiveProjectId, file);
      await handleUpdateFrame(publicUrl, 'upload');
    } catch (err) {
      console.error('Failed to upload shot frame image:', err);
      setFrameError(err instanceof Error ? err.message : 'Failed to upload frame image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearFrame = async () => {
    if (readOnly || !shot || isClearing || isUploading || isAssigningRef) return;
    setIsClearing(true);
    setFrameError(null);
    try {
      await handleUpdateFrame('', 'none');
    } catch (err) {
      // error handled in handleUpdateFrame
    } finally {
      setIsClearing(false);
    }
  };

  const hasFrame = shotHasVisualFrame(shot.visual_source, shot.visual_url);

  return (
    <aside
      aria-label="Shot Inspector"
      className="absolute top-16 right-6 w-84 z-30 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-border/80 bg-[#161513]/95 backdrop-blur-md shadow-2xl p-4 text-foreground flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200 custom-scrollbar"
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

      {/* Visual Frame Acquisition Section */}
      <div className="space-y-2 p-2.5 rounded-lg bg-surface/50 border border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-accent" />
            Visual Frame
          </span>
          {hasFrame && (
            <span className="text-[10px] font-mono text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-surface border border-border/50">
              {shot.visual_source === 'reference' ? 'Reference' : 'Upload'}
            </span>
          )}
        </div>

        {/* Current Frame Preview (or Empty Frame State) */}
        <div
          className="relative w-full rounded-md overflow-hidden bg-[#11100E] border border-border/60 flex items-center justify-center transition-all"
          style={{
            aspectRatio: (aspectRatio || shot.aspect_ratio || '16:9').replace(':', '/'),
            maxHeight: (aspectRatio || shot.aspect_ratio) === '9:16' ? '200px' : '150px',
          }}
        >
          {hasFrame ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getShotFrameImageUrl(shot.visual_url)}
                alt="Shot Frame Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm border border-white/10 text-[9px] font-mono font-medium text-foreground uppercase tracking-wider">
                {shot.visual_source === 'reference' ? 'Reference' : 'Upload'}
              </div>
              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm border border-white/10 text-[9px] font-mono text-muted-foreground">
                {aspectRatio || shot.aspect_ratio || '16:9'}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-3 text-center">
              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
              <span className="text-[10px] font-medium text-muted-foreground/80">Empty Frame</span>
              <span className="text-[9px] text-muted-foreground/50">
                {readOnly ? 'No visual frame assigned' : 'Assign a linked reference or upload an image'}
              </span>
            </div>
          )}
        </div>

        {/* Error message */}
        {frameError && (
          <div className="text-[10px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 flex items-center justify-between gap-1.5">
            <span className="flex-1">{frameError}</span>
            <button
              type="button"
              onClick={() => setFrameError(null)}
              className="text-destructive/80 hover:text-destructive flex-shrink-0"
              aria-label="Dismiss error"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Action Buttons: Upload & Clear */}
        {!readOnly && (
          <div className="flex items-center gap-2 pt-0.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading || isClearing || isAssigningRef}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              disabled={isUploading || isClearing || isAssigningRef}
              className="flex-1 h-7 text-xs bg-surface/60 border-border hover:bg-surface text-foreground gap-1.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 text-accent" />
                  <span>Upload Image</span>
                </>
              )}
            </Button>

            {hasFrame && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFrame}
                disabled={isClearing || isUploading || isAssigningRef}
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2 gap-1"
                title="Clear visual frame"
              >
                {isClearing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Clear</span>
              </Button>
            )}
          </div>
        )}

        {/* Assign Reference as Frame */}
        <div className="space-y-1.5 pt-1.5 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              Linked References ({shot.references?.length || 0})
            </span>
          </div>

          {!shot.references || shot.references.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/80 italic p-2 rounded bg-surface/30 border border-border/30">
              No references linked to this shot. Link references to this shot to choose one as the visual frame.
            </p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
              {shot.references.map((ref) => {
                const isSelected =
                  shot.visual_source === 'reference' &&
                  Boolean(ref.thumbnail_url) &&
                  shot.visual_url === ref.thumbnail_url;

                return (
                  <button
                    key={ref.id}
                    type="button"
                    disabled={readOnly || isAssigningRef || isUploading || isClearing || !ref.thumbnail_url}
                    onClick={() => handleAssignReference(ref)}
                    className={`w-full flex items-center gap-2 p-1.5 rounded border text-left transition-all ${
                      isSelected
                        ? 'bg-accent/15 border-accent text-foreground ring-1 ring-accent/30'
                        : 'bg-surface/40 border-border/50 text-muted-foreground hover:text-foreground hover:bg-surface/70'
                    } ${!ref.thumbnail_url ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={
                      !ref.thumbnail_url
                        ? 'Reference has no thumbnail image'
                        : isSelected
                        ? 'Active visual frame'
                        : 'Set as visual frame'
                    }
                  >
                    <div className="w-9 h-6 rounded overflow-hidden bg-[#11100E] border border-border/60 flex-shrink-0 flex items-center justify-center">
                      {ref.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getShotFrameImageUrl(ref.thumbnail_url)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-3 w-3 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate text-foreground leading-tight">
                        {ref.title || 'Untitled Reference'}
                      </p>
                      <p className="text-[9px] text-muted-foreground truncate leading-tight">
                        {ref.source_domain || (ref.thumbnail_url ? 'Reference frame' : 'No image')}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
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
