import type { Database } from '@/types/database.types';
import type { Reference } from '@/features/references/types';

export type MoodboardItemRow = Database['public']['Tables']['moodboard_items']['Row'];
export type MoodboardItemInsert = Database['public']['Tables']['moodboard_items']['Insert'];
export type MoodboardItemUpdate = Database['public']['Tables']['moodboard_items']['Update'];

export type MoodboardItemType = 'reference' | 'image' | 'text' | 'color' | 'idea' | 'stroke';

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';

export interface ItemConnection {
  id: string;
  targetId: string;
  fromAnchor?: AnchorPosition;
  toAnchor?: AnchorPosition;
  label?: string;
}

export interface ResolvedConnection {
  id: string;
  fromId: string;
  targetId: string;
  fromAnchor: AnchorPosition;
  toAnchor: AnchorPosition;
  label?: string;
}

export interface BaseItemContent {
  connections?: ItemConnection[];
}

export interface ReferenceItemContent extends BaseItemContent {
  url?: string;
  title?: string;
  thumbnail_url?: string;
  source_domain?: string;
}

export interface ImageItemContent extends BaseItemContent {
  imageUrl: string;
  fileName?: string;
  originalWidth?: number;
  originalHeight?: number;
}

export interface TextItemContent extends BaseItemContent {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
}

export interface ColorItemContent extends BaseItemContent {
  hex: string;
  label?: string;
}

export interface IdeaItemContent extends BaseItemContent {
  title: string;
  notes?: string;
}

export interface StrokeItemContent extends BaseItemContent {
  points: number[];
  color: string;
  strokeWidth: number;
  tension?: number;
}

export type MoodboardItemContent =
  | ReferenceItemContent
  | ImageItemContent
  | TextItemContent
  | ColorItemContent
  | IdeaItemContent
  | StrokeItemContent;

export interface MoodboardItem extends Omit<MoodboardItemRow, 'content' | 'type'> {
  type: MoodboardItemType;
  content: MoodboardItemContent;
  reference?: Reference | null;
}

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}

/**
 * Pen width constants (SCREEN-SPACE width in pixels).
 * The slider provides continuous selection within this range.
 * Converted through viewport zoom scale via screenDistanceToCanvas().
 */
export const DEFAULT_PEN_WIDTH = 4;
export const MIN_PEN_WIDTH = 1;
export const MAX_PEN_WIDTH = 40;

/**
 * Eraser size constants (SCREEN-SPACE RADIUS in pixels).
 * The slider provides continuous selection within this range.
 * Both the live visual guide ring and the authoritative stroke-cutting
 * calculation consume these values directly as radii, converted through
 * viewport zoom scale via screenDistanceToCanvas().
 * These are NOT diameters.
 */
export type EraserSize = number;

export const DEFAULT_ERASER_SIZE: EraserSize = 16;
export const MIN_ERASER_SIZE = 4;
export const MAX_ERASER_SIZE = 48;

