export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          share_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          share_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string;
          share_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      references: {
        Row: {
          id: string;
          project_id: string;
          url: string;
          title: string;
          thumbnail_url: string;
          source_domain: string;
          note: string;
          tags: string[];
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          url: string;
          title: string;
          thumbnail_url?: string;
          source_domain?: string;
          note?: string;
          tags?: string[];
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          url?: string;
          title?: string;
          thumbnail_url?: string;
          source_domain?: string;
          note?: string;
          tags?: string[];
          created_at?: string;
          deleted_at?: string | null;
        };
      };
      moodboard_items: {
        Row: {
          id: string;
          project_id: string;
          reference_id: string | null;
          type: 'reference' | 'image' | 'text' | 'color' | 'idea' | 'stroke';
          content: Json;
          x: number;
          y: number;
          width: number;
          height: number;
          z_index: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          reference_id?: string | null;
          type: 'reference' | 'image' | 'text' | 'color' | 'idea' | 'stroke';
          content?: Json;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          z_index?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          reference_id?: string | null;
          type?: 'reference' | 'image' | 'text' | 'color' | 'idea' | 'stroke';
          content?: Json;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          z_index?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      direction_notes: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string;
          category: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string;
          category?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string;
          category?: string | null;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      direction_reference_links: {
        Row: {
          id: string;
          direction_note_id: string;
          reference_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          direction_note_id: string;
          reference_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          direction_note_id?: string;
          reference_id?: string;
          created_at?: string;
        };
      };
      storyboard_scenes: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string;
          x: number;
          y: number;
          width: number;
          height: number;
          display_order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title?: string;
          description?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      storyboard_shots: {
        Row: {
          id: string;
          project_id: string;
          scene_id: string;
          shot_number: string;
          title: string;
          description: string;
          dialogue: string;
          aspect_ratio: '16:9' | '9:16' | '1:1' | '4:3';
          shot_type: string | null;
          camera_movement: string | null;
          visual_url: string;
          visual_source: 'none' | 'reference' | 'upload' | 'sketch';
          sketch_data: Json | null;
          x: number;
          y: number;
          width: number;
          height: number;
          z_index: number;
          display_order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          scene_id: string;
          shot_number?: string;
          title?: string;
          description?: string;
          dialogue?: string;
          aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3';
          shot_type?: string | null;
          camera_movement?: string | null;
          visual_url?: string;
          visual_source?: 'none' | 'reference' | 'upload' | 'sketch';
          sketch_data?: Json | null;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          z_index?: number;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          scene_id?: string;
          shot_number?: string;
          title?: string;
          description?: string;
          dialogue?: string;
          aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3';
          shot_type?: string | null;
          camera_movement?: string | null;
          visual_url?: string;
          visual_source?: 'none' | 'reference' | 'upload' | 'sketch';
          sketch_data?: Json | null;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          z_index?: number;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      storyboard_shot_references: {
        Row: {
          id: string;
          shot_id: string;
          reference_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shot_id: string;
          reference_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shot_id?: string;
          reference_id?: string;
          created_at?: string;
        };
      };
      storyboard_shot_direction_links: {
        Row: {
          id: string;
          shot_id: string;
          direction_note_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shot_id: string;
          direction_note_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shot_id?: string;
          direction_note_id?: string;
          created_at?: string;
        };
      };
      storyboard_shot_connections: {
        Row: {
          id: string;
          project_id: string;
          from_shot_id: string;
          to_shot_id: string;
          from_anchor: 'top' | 'right' | 'bottom' | 'left';
          to_anchor: 'top' | 'right' | 'bottom' | 'left';
          transition_label: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          from_shot_id: string;
          to_shot_id: string;
          from_anchor?: 'top' | 'right' | 'bottom' | 'left';
          to_anchor?: 'top' | 'right' | 'bottom' | 'left';
          transition_label?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          from_shot_id?: string;
          to_shot_id?: string;
          from_anchor?: 'top' | 'right' | 'bottom' | 'left';
          to_anchor?: 'top' | 'right' | 'bottom' | 'left';
          transition_label?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_shared_project_bundle: {
        Args: {
          p_token: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
