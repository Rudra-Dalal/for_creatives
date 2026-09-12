import type { Database, Json } from '@/types/database.types';
import type { Reference } from '@/features/references/types';
import type { DirectionNote } from '@/features/creative-direction/types';

/**
 * Supported aspect ratios for storyboard shots and frames.
 * Default is 16:9 (cinematic widescreen), but the architecture
 * natively supports vertical (9:16), square (1:1), and classic (4:3).
 */
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';

/**
 * Visual source provenance:
 * - 'none': Card has no visual frame assigned yet
 * - 'reference': Frame is sourced directly from a project reference
 * - 'upload': Frame is a user-uploaded image file
 * - 'sketch': Frame is an in-app sketch drawn in the sketch editor
 */
export const SHOT_VISUAL_SOURCES = ['none', 'reference', 'upload', 'sketch'] as const;
export type ShotVisualSource = (typeof SHOT_VISUAL_SOURCES)[number];

/**
 * Lightweight framing / shot types.
 */
export const SHOT_TYPES = [
  'extreme_wide',
  'wide',
  'medium_wide',
  'medium',
  'medium_close_up',
  'close_up',
  'extreme_close_up',
  'pov',
  'over_the_shoulder',
  'aerial',
  'other',
] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

export const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  extreme_wide: 'Extreme Wide (EWS)',
  wide: 'Wide Shot (WS)',
  medium_wide: 'Medium Wide (MWS)',
  medium: 'Medium Shot (MS)',
  medium_close_up: 'Medium Close-Up (MCU)',
  close_up: 'Close-Up (CU)',
  extreme_close_up: 'Extreme Close-Up (ECU)',
  pov: 'Point of View (POV)',
  over_the_shoulder: 'Over the Shoulder (OTS)',
  aerial: 'Aerial / Bird Eye',
  other: 'Other',
};

/**
 * Lightweight camera movement options.
 */
export const CAMERA_MOVEMENTS = [
  'static',
  'pan',
  'tilt',
  'dolly',
  'zoom',
  'tracking',
  'handheld',
  'crane',
  'other',
] as const;
export type CameraMovement = (typeof CAMERA_MOVEMENTS)[number];

export const CAMERA_MOVEMENT_LABELS: Record<CameraMovement, string> = {
  static: 'Static',
  pan: 'Pan',
  tilt: 'Tilt',
  dolly: 'Dolly',
  zoom: 'Zoom',
  tracking: 'Tracking',
  handheld: 'Handheld',
  crane: 'Crane',
  other: 'Other',
};

/**
 * Vector stroke model for editable sketches.
 * Stored strictly inside `sketch_data` when visual_source is 'sketch' (or annotated).
 */
export interface SketchStroke {
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface ShotSketchData {
  version: number;
  aspectRatio: AspectRatio;
  strokes: SketchStroke[];
}

// Database Entity Types
export type StoryboardScene = Database['public']['Tables']['storyboard_scenes']['Row'];
export type StoryboardSceneInsert = Database['public']['Tables']['storyboard_scenes']['Insert'];
export type StoryboardSceneUpdate = Database['public']['Tables']['storyboard_scenes']['Update'];

export type StoryboardShot = Database['public']['Tables']['storyboard_shots']['Row'];
export type StoryboardShotInsert = Database['public']['Tables']['storyboard_shots']['Insert'];
export type StoryboardShotUpdate = Database['public']['Tables']['storyboard_shots']['Update'];

export type StoryboardShotReference = Database['public']['Tables']['storyboard_shot_references']['Row'];
export type StoryboardShotReferenceInsert = Database['public']['Tables']['storyboard_shot_references']['Insert'];

export type StoryboardShotDirectionLink = Database['public']['Tables']['storyboard_shot_direction_links']['Row'];
export type StoryboardShotDirectionLinkInsert = Database['public']['Tables']['storyboard_shot_direction_links']['Insert'];

/**
 * Composite Shot model including resolved linked references and direction notes.
 */
export interface StoryboardShotWithLinks extends Omit<StoryboardShot, 'sketch_data'> {
  sketch_data: ShotSketchData | Json | null;
  references: Reference[];
  direction_notes: DirectionNote[];
}

/**
 * Composite Scene model including its ordered shots.
 */
export interface StoryboardSceneWithShots extends StoryboardScene {
  shots: StoryboardShotWithLinks[];
}
