export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          payload: Json
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          type?: string
        }
        Relationships: []
      }
      instruments: {
        Row: {
          code: string
          created_at: string
          family: string | null
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          family?: string | null
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          family?: string | null
          id?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      omr_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          engine: string
          error_message: string | null
          id: string
          raw_output: Json | null
          score_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          engine: string
          error_message?: string | null
          id?: string
          raw_output?: Json | null
          score_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          engine?: string
          error_message?: string | null
          id?: string
          raw_output?: Json | null
          score_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "omr_jobs_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "scores"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          instrument_id: string | null
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          instrument_id?: string | null
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          instrument_id?: string | null
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          ensemble_type: string
          id: string
          invite_code: string | null
          max_members: number | null
          name: string
          owner_user_id: string
          seats_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          ensemble_type?: string
          id?: string
          invite_code?: string | null
          max_members?: number | null
          name: string
          owner_user_id: string
          seats_limit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          ensemble_type?: string
          id?: string
          invite_code?: string | null
          max_members?: number | null
          name?: string
          owner_user_id?: string
          seats_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          created_at: string
          desk_count: number
          id: string
          instrument_id: string | null
          name: string
          part_order: number
          work_version_id: string
        }
        Insert: {
          created_at?: string
          desk_count?: number
          id?: string
          instrument_id?: string | null
          name: string
          part_order?: number
          work_version_id: string
        }
        Update: {
          created_at?: string
          desk_count?: number
          id?: string
          instrument_id?: string | null
          name?: string
          part_order?: number
          work_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_work_version_id_fkey"
            columns: ["work_version_id"]
            isOneToOne: false
            referencedRelation: "work_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_interval: string | null
          code: string
          ensemble_type: string | null
          id: string
          is_active: boolean
          max_members: number | null
          name: string | null
          plan_type: string
          price_cents: number
          seat_price_cents: number
          seats_included: number
          stripe_price_id: string | null
          stripe_seat_price_id: string | null
          trial_days: number | null
        }
        Insert: {
          billing_interval?: string | null
          code: string
          ensemble_type?: string | null
          id?: string
          is_active?: boolean
          max_members?: number | null
          name?: string | null
          plan_type: string
          price_cents?: number
          seat_price_cents?: number
          seats_included?: number
          stripe_price_id?: string | null
          stripe_seat_price_id?: string | null
          trial_days?: number | null
        }
        Update: {
          billing_interval?: string | null
          code?: string
          ensemble_type?: string | null
          id?: string
          is_active?: boolean
          max_members?: number | null
          name?: string | null
          plan_type?: string
          price_cents?: number
          seat_price_cents?: number
          seats_included?: number
          stripe_price_id?: string | null
          stripe_seat_price_id?: string | null
          trial_days?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_instrument_id: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean
          is_suspended: boolean
          preferred_language: string
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_instrument_id?: string | null
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          is_suspended?: boolean
          preferred_language?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_instrument_id?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          is_suspended?: boolean
          preferred_language?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_default_instrument"
            columns: ["default_instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      score_measures: {
        Row: {
          id: string
          measure_number: number
          score_system_id: string
          x_end: number
          x_start: number
        }
        Insert: {
          id?: string
          measure_number: number
          score_system_id: string
          x_end: number
          x_start: number
        }
        Update: {
          id?: string
          measure_number?: number
          score_system_id?: string
          x_end?: number
          x_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_measures_score_system_id_fkey"
            columns: ["score_system_id"]
            isOneToOne: false
            referencedRelation: "score_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      score_pages: {
        Row: {
          height_px: number | null
          id: string
          image_path: string
          page_number: number
          score_id: string
          width_px: number | null
        }
        Insert: {
          height_px?: number | null
          id?: string
          image_path: string
          page_number: number
          score_id: string
          width_px?: number | null
        }
        Update: {
          height_px?: number | null
          id?: string
          image_path?: string
          page_number?: number
          score_id?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "score_pages_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "scores"
            referencedColumns: ["id"]
          },
        ]
      }
      score_staves: {
        Row: {
          bbox_h: number
          bbox_w: number
          bbox_x: number
          bbox_y: number
          created_at: string
          id: string
          part_id: string | null
          score_system_id: string
          staff_order: number
        }
        Insert: {
          bbox_h: number
          bbox_w: number
          bbox_x: number
          bbox_y: number
          created_at?: string
          id?: string
          part_id?: string | null
          score_system_id: string
          staff_order: number
        }
        Update: {
          bbox_h?: number
          bbox_w?: number
          bbox_x?: number
          bbox_y?: number
          created_at?: string
          id?: string
          part_id?: string | null
          score_system_id?: string
          staff_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_staves_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_staves_score_system_id_fkey"
            columns: ["score_system_id"]
            isOneToOne: false
            referencedRelation: "score_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      score_systems: {
        Row: {
          bbox_h: number | null
          bbox_w: number | null
          bbox_x: number | null
          bbox_y: number | null
          confidence: number | null
          created_at: string
          detection_source: string
          id: string
          instrument_id: string | null
          is_manually_corrected: boolean
          measure_count: number
          measure_start: number
          score_page_id: string
          system_order: number
        }
        Insert: {
          bbox_h?: number | null
          bbox_w?: number | null
          bbox_x?: number | null
          bbox_y?: number | null
          confidence?: number | null
          created_at?: string
          detection_source?: string
          id?: string
          instrument_id?: string | null
          is_manually_corrected?: boolean
          measure_count: number
          measure_start: number
          score_page_id: string
          system_order: number
        }
        Update: {
          bbox_h?: number | null
          bbox_w?: number | null
          bbox_x?: number | null
          bbox_y?: number | null
          confidence?: number | null
          created_at?: string
          detection_source?: string
          id?: string
          instrument_id?: string | null
          is_manually_corrected?: boolean
          measure_count?: number
          measure_start?: number
          score_page_id?: string
          system_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_systems_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_systems_score_page_id_fkey"
            columns: ["score_page_id"]
            isOneToOne: false
            referencedRelation: "score_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          analysis: Json | null
          created_at: string
          file_path: string
          file_type: string
          id: string
          omr_engine: string | null
          owner_id: string
          page_count: number
          part_id: string | null
          status: string
          updated_at: string
          work_version_id: string
        }
        Insert: {
          analysis?: Json | null
          created_at?: string
          file_path: string
          file_type: string
          id?: string
          omr_engine?: string | null
          owner_id: string
          page_count?: number
          part_id?: string | null
          status?: string
          updated_at?: string
          work_version_id: string
        }
        Update: {
          analysis?: Json | null
          created_at?: string
          file_path?: string
          file_type?: string
          id?: string
          omr_engine?: string | null
          owner_id?: string
          page_count?: number
          part_id?: string | null
          status?: string
          updated_at?: string
          work_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_work_version_id_fkey"
            columns: ["work_version_id"]
            isOneToOne: false
            referencedRelation: "work_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          id: string
          instrument_id: string | null
          is_active: boolean
          joined_at: string
          left_at: string | null
          part_id: string | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          instrument_id?: string | null
          is_active?: boolean
          joined_at?: string
          left_at?: string | null
          part_id?: string | null
          role?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          instrument_id?: string | null
          is_active?: boolean
          joined_at?: string
          left_at?: string | null
          part_id?: string | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          allow_part_selection: boolean
          count_in_measures: number
          created_at: string
          current_measure: number
          director_user_id: string
          id: string
          organization_id: string | null
          playback_started_at: string | null
          room_code: string
          status: string
          sync_mode: string
          tempo_bpm: number
          updated_at: string
          work_version_id: string
        }
        Insert: {
          allow_part_selection?: boolean
          count_in_measures?: number
          created_at?: string
          current_measure?: number
          director_user_id: string
          id?: string
          organization_id?: string | null
          playback_started_at?: string | null
          room_code: string
          status?: string
          sync_mode?: string
          tempo_bpm: number
          updated_at?: string
          work_version_id: string
        }
        Update: {
          allow_part_selection?: boolean
          count_in_measures?: number
          created_at?: string
          current_measure?: number
          director_user_id?: string
          id?: string
          organization_id?: string | null
          playback_started_at?: string | null
          room_code?: string
          status?: string
          sync_mode?: string
          tempo_bpm?: number
          updated_at?: string
          work_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_director_user_id_fkey"
            columns: ["director_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_work_version_id_fkey"
            columns: ["work_version_id"]
            isOneToOne: false
            referencedRelation: "work_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      stand_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          desk_number: number
          id: string
          organization_id: string
          part_id: string
          updated_at: string
          user_id: string
          work_version_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          desk_number?: number
          id?: string
          organization_id: string
          part_id: string
          updated_at?: string
          user_id: string
          work_version_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          desk_number?: number
          id?: string
          organization_id?: string
          part_id?: string
          updated_at?: string
          user_id?: string
          work_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stand_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stand_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stand_assignments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stand_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stand_assignments_work_version_id_fkey"
            columns: ["work_version_id"]
            isOneToOne: false
            referencedRelation: "work_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string | null
          owner_user_id: string | null
          plan_id: string
          seat_quantity: number
          status: string
          stripe_customer_id: string | null
          stripe_seat_item_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string | null
          owner_user_id?: string | null
          plan_id: string
          seat_quantity?: number
          status: string
          stripe_customer_id?: string | null
          stripe_seat_item_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string | null
          owner_user_id?: string | null
          plan_id?: string
          seat_quantity?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_seat_item_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      work_versions: {
        Row: {
          created_at: string
          id: string
          playback_map: Json
          tempo_bpm_override: number | null
          total_measures_override: number | null
          updated_at: string
          version_name: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          playback_map?: Json
          tempo_bpm_override?: number | null
          total_measures_override?: number | null
          updated_at?: string
          version_name: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          playback_map?: Json
          tempo_bpm_override?: number | null
          total_measures_override?: number | null
          updated_at?: string
          version_name?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_versions_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          catalog_reference: string | null
          composer: string | null
          created_at: string
          default_tempo_bpm: number | null
          genre: string | null
          id: string
          key_signature: string | null
          organization_id: string | null
          owner_id: string
          search_vector: unknown
          time_signature: string | null
          title: string
          total_measures: number | null
          updated_at: string
        }
        Insert: {
          catalog_reference?: string | null
          composer?: string | null
          created_at?: string
          default_tempo_bpm?: number | null
          genre?: string | null
          id?: string
          key_signature?: string | null
          organization_id?: string | null
          owner_id: string
          search_vector?: unknown
          time_signature?: string | null
          title: string
          total_measures?: number | null
          updated_at?: string
        }
        Update: {
          catalog_reference?: string | null
          composer?: string | null
          created_at?: string
          default_tempo_bpm?: number | null
          genre?: string | null
          id?: string
          key_signature?: string | null
          organization_id?: string | null
          owner_id?: string
          search_vector?: unknown
          time_signature?: string | null
          title?: string
          total_measures?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "works_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_work_version: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      can_read_work_version: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      create_session: {
        Args: { p_tempo_bpm?: number; p_work_version_id: string }
        Returns: {
          allow_part_selection: boolean
          count_in_measures: number
          created_at: string
          current_measure: number
          director_user_id: string
          id: string
          organization_id: string | null
          playback_started_at: string | null
          room_code: string
          status: string
          sync_mode: string
          tempo_bpm: number
          updated_at: string
          work_version_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensemble_billable_seats: { Args: { p_org_id: string }; Returns: number }
      f_unaccent: { Args: { "": string }; Returns: string }
      is_ensemble_director: { Args: { p_org_id: string }; Returns: boolean }
      is_ensemble_member: { Args: { p_org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_session_participant: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      join_ensemble: {
        Args: { p_invite_code: string }
        Returns: {
          created_at: string
          ensemble_type: string
          id: string
          invite_code: string | null
          max_members: number | null
          name: string
          owner_user_id: string
          seats_limit: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_session: {
        Args: { p_room_code: string }
        Returns: {
          allow_part_selection: boolean
          count_in_measures: number
          created_at: string
          current_measure: number
          director_user_id: string
          id: string
          organization_id: string | null
          playback_started_at: string | null
          room_code: string
          status: string
          sync_mode: string
          tempo_bpm: number
          updated_at: string
          work_version_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_session: { Args: { p_session_id: string }; Returns: undefined }
      reset_score_markup: { Args: { p_score_id: string }; Returns: undefined }
      transfer_director: {
        Args: { p_new_director_id: string; p_session_id: string }
        Returns: undefined
      }
      user_has_active_plan: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
