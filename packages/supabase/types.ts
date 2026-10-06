export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          preferred_language: string
          default_instrument_id: string | null
          is_platform_admin: boolean
          is_suspended: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_language?: string
          default_instrument_id?: string | null
          is_platform_admin?: boolean
          is_suspended?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          preferred_language?: string
          default_instrument_id?: string | null
          is_platform_admin?: boolean
          is_suspended?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      instruments: {
        Row: {
          id: string
          code: string
          family: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          family?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          family?: string | null
          created_at?: string
        }
      }
      works: {
        Row: {
          id: string
          owner_id: string
          title: string
          composer: string | null
          catalog_reference: string | null
          genre: string | null
          key_signature: string | null
          time_signature: string | null
          default_tempo_bpm: number | null
          total_measures: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          composer?: string | null
          catalog_reference?: string | null
          genre?: string | null
          key_signature?: string | null
          time_signature?: string | null
          default_tempo_bpm?: number | null
          total_measures?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          composer?: string | null
          catalog_reference?: string | null
          genre?: string | null
          key_signature?: string | null
          time_signature?: string | null
          default_tempo_bpm?: number | null
          total_measures?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      work_versions: {
        Row: {
          id: string
          work_id: string
          version_name: string
          tempo_bpm_override: number | null
          total_measures_override: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_id: string
          version_name: string
          tempo_bpm_override?: number | null
          total_measures_override?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_id?: string
          version_name?: string
          tempo_bpm_override?: number | null
          total_measures_override?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      scores: {
        Row: {
          id: string
          work_version_id: string
          owner_id: string
          file_path: string
          file_type: 'pdf' | 'image'
          page_count: number
          status: 'uploaded' | 'processing_omr' | 'ready' | 'error'
          omr_engine: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_version_id: string
          owner_id: string
          file_path: string
          file_type: 'pdf' | 'image'
          page_count?: number
          status?: 'uploaded' | 'processing_omr' | 'ready' | 'error'
          omr_engine?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_version_id?: string
          owner_id?: string
          file_path?: string
          file_type?: 'pdf' | 'image'
          page_count?: number
          status?: 'uploaded' | 'processing_omr' | 'ready' | 'error'
          omr_engine?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      score_pages: {
        Row: {
          id: string
          score_id: string
          page_number: number
          image_path: string
          width_px: number | null
          height_px: number | null
        }
        Insert: {
          id?: string
          score_id: string
          page_number: number
          image_path: string
          width_px?: number | null
          height_px?: number | null
        }
        Update: {
          id?: string
          score_id?: string
          page_number?: number
          image_path?: string
          width_px?: number | null
          height_px?: number | null
        }
      }
      score_systems: {
        Row: {
          id: string
          score_page_id: string
          instrument_id: string | null
          system_order: number
          measure_start: number
          measure_count: number
          bbox_x: number | null
          bbox_y: number | null
          bbox_w: number | null
          bbox_h: number | null
          is_manually_corrected: boolean
          created_at: string
        }
        Insert: {
          id?: string
          score_page_id: string
          instrument_id?: string | null
          system_order: number
          measure_start: number
          measure_count: number
          bbox_x?: number | null
          bbox_y?: number | null
          bbox_w?: number | null
          bbox_h?: number | null
          is_manually_corrected?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          score_page_id?: string
          instrument_id?: string | null
          system_order?: number
          measure_start?: number
          measure_count?: number
          bbox_x?: number | null
          bbox_y?: number | null
          bbox_w?: number | null
          bbox_h?: number | null
          is_manually_corrected?: boolean
          created_at?: string
        }
      }
      omr_jobs: {
        Row: {
          id: string
          score_id: string
          engine: string
          status: 'queued' | 'running' | 'done' | 'failed'
          raw_output: Json | null
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          score_id: string
          engine: string
          status?: 'queued' | 'running' | 'done' | 'failed'
          raw_output?: Json | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          score_id?: string
          engine?: string
          status?: 'queued' | 'running' | 'done' | 'failed'
          raw_output?: Json | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      sessions: {
        Row: {
          id: string
          room_code: string
          work_version_id: string
          director_user_id: string
          status: 'waiting' | 'playing' | 'paused' | 'stopped' | 'ended'
          tempo_bpm: number
          current_measure: number
          playback_started_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_code: string
          work_version_id: string
          director_user_id: string
          status?: 'waiting' | 'playing' | 'paused' | 'stopped' | 'ended'
          tempo_bpm: number
          current_measure?: number
          playback_started_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_code?: string
          work_version_id?: string
          director_user_id?: string
          status?: 'waiting' | 'playing' | 'paused' | 'stopped' | 'ended'
          tempo_bpm?: number
          current_measure?: number
          playback_started_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      session_participants: {
        Row: {
          id: string
          session_id: string
          user_id: string
          instrument_id: string | null
          role: 'director' | 'performer'
          is_active: boolean
          joined_at: string
          left_at: string | null
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          instrument_id?: string | null
          role?: 'director' | 'performer'
          is_active?: boolean
          joined_at?: string
          left_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          instrument_id?: string | null
          role?: 'director' | 'performer'
          is_active?: boolean
          joined_at?: string
          left_at?: string | null
        }
      }
      organizations: {
        Row: {
          id: string
          owner_user_id: string
          name: string
          seats_limit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          name: string
          seats_limit?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          name?: string
          seats_limit?: number
          created_at?: string
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          invited_by?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          invited_by?: string | null
          joined_at?: string
        }
      }
      plans: {
        Row: {
          id: string
          code: string
          plan_type: 'individual' | 'organization'
          seats_included: number
          stripe_price_id: string | null
          billing_interval: 'month' | 'year' | null
          is_active: boolean
        }
        Insert: {
          id?: string
          code: string
          plan_type: 'individual' | 'organization'
          seats_included?: number
          stripe_price_id?: string | null
          billing_interval?: 'month' | 'year' | null
          is_active?: boolean
        }
        Update: {
          id?: string
          code?: string
          plan_type?: 'individual' | 'organization'
          seats_included?: number
          stripe_price_id?: string | null
          billing_interval?: 'month' | 'year' | null
          is_active?: boolean
        }
      }
      subscriptions: {
        Row: {
          id: string
          plan_id: string
          owner_user_id: string | null
          organization_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          owner_user_id?: string | null
          organization_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          owner_user_id?: string | null
          organization_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      admin_notifications: {
        Row: {
          id: string
          type: string
          payload: Json
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          payload?: Json
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          payload?: Json
          is_read?: boolean
          created_at?: string
        }
      }
      moderation_actions: {
        Row: {
          id: string
          admin_id: string
          action: 'suspend_user' | 'reinstate_user' | 'remove_score' | 'warn_user'
          target_type: 'user' | 'score'
          target_id: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          action: 'suspend_user' | 'reinstate_user' | 'remove_score' | 'warn_user'
          target_type: 'user' | 'score'
          target_id: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_id?: string
          action?: 'suspend_user' | 'reinstate_user' | 'remove_score' | 'warn_user'
          target_type?: 'user' | 'score'
          target_id?: string
          reason?: string | null
          created_at?: string
        }
      }
    }
  }
}
