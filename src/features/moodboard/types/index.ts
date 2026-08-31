import type { Database } from '@/types/database.types';
import type { Reference } from '@/features/references/types';

export type MoodboardItemRow = Database['public']['Tables']['moodboard_items']['Row'];
export type MoodboardItemInsert = Database['public']['Tables']['moodboard_items']['Insert'];
export type MoodboardItemUpdate = Database['public']['Tables']['moodboard_items']['Update'];

export type MoodboardItemType = 'reference' | 'text';

export interface ReferenceItemContent {
  url?: string;
  title?: string;
  thumbnail_url?: string;
  source_domain?: string;
}

export interface TextItemContent {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
}

export type MoodboardItemContent = ReferenceItemContent | TextItemContent;

export interface MoodboardItem extends Omit<MoodboardItemRow, 'content'> {
  content: MoodboardItemContent;
  reference?: Reference | null;
}

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}
