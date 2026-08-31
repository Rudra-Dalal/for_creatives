import type { Database } from './database.types';

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type ReferenceRow = Database['public']['Tables']['references']['Row'];
export type ReferenceInsert = Database['public']['Tables']['references']['Insert'];
export type ReferenceUpdate = Database['public']['Tables']['references']['Update'];

export type MoodboardItemRow = Database['public']['Tables']['moodboard_items']['Row'];
export type MoodboardItemInsert = Database['public']['Tables']['moodboard_items']['Insert'];
export type MoodboardItemUpdate = Database['public']['Tables']['moodboard_items']['Update'];

export type DirectionNoteRow = Database['public']['Tables']['direction_notes']['Row'];
export type DirectionNoteInsert = Database['public']['Tables']['direction_notes']['Insert'];
export type DirectionNoteUpdate = Database['public']['Tables']['direction_notes']['Update'];

export type DirectionReferenceLinkRow = Database['public']['Tables']['direction_reference_links']['Row'];
export type DirectionReferenceLinkInsert = Database['public']['Tables']['direction_reference_links']['Insert'];
export type DirectionReferenceLinkUpdate = Database['public']['Tables']['direction_reference_links']['Update'];

export interface ScrapedMetadata {
  url: string;
  title: string;
  thumbnail_url: string;
  source_domain: string;
  description?: string;
  fallbackNeeded?: boolean;
}
