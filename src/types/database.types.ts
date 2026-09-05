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
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string;
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
