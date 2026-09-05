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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bottles: {
        Row: {
          archived_at: string | null
          brand: string | null
          capacity_ml: number
          created_at: string
          id: string
          is_primary: boolean
          model: string | null
          name: string
          typical_fill_ml: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          brand?: string | null
          capacity_ml: number
          created_at?: string
          id?: string
          is_primary?: boolean
          model?: string | null
          name: string
          typical_fill_ml?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          brand?: string | null
          capacity_ml?: number
          created_at?: string
          id?: string
          is_primary?: boolean
          model?: string | null
          name?: string
          typical_fill_ml?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bottles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_profiles: {
        Row: {
          display_name: string
          is_visible: boolean
          joined_at: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          display_name: string
          is_visible?: boolean
          joined_at?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          display_name?: string
          is_visible?: boolean
          joined_at?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      community_username_reservations: {
        Row: {
          reserved_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          reserved_at?: string
          user_id?: string | null
          username: string
        }
        Update: {
          reserved_at?: string
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          battery_percent: number | null
          bottle_id: string | null
          created_at: string
          credential_hash: string | null
          device_type: string
          firmware_version: string | null
          id: string
          last_seen_at: string | null
          last_synced_at: string | null
          name: string
          revoked_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          battery_percent?: number | null
          bottle_id?: string | null
          created_at?: string
          credential_hash?: string | null
          device_type: string
          firmware_version?: string | null
          id?: string
          last_seen_at?: string | null
          last_synced_at?: string | null
          name: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          battery_percent?: number | null
          bottle_id?: string | null
          created_at?: string
          credential_hash?: string | null
          device_type?: string
          firmware_version?: string | null
          id?: string
          last_seen_at?: string | null
          last_synced_at?: string | null
          name?: string
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_bottle_owner_fk"
            columns: ["bottle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bottles"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hydration_events: {
        Row: {
          bottle_id: string
          corrects_event_id: string | null
          created_at: string
          device_id: string | null
          event_type: string
          id: string
          idempotency_key: string
          metadata: Json
          occurred_at: string
          received_at: string
          reverses_event_id: string | null
          source: string
          user_id: string
          volume_ml: number | null
        }
        Insert: {
          bottle_id: string
          corrects_event_id?: string | null
          created_at?: string
          device_id?: string | null
          event_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          occurred_at: string
          received_at?: string
          reverses_event_id?: string | null
          source: string
          user_id: string
          volume_ml?: number | null
        }
        Update: {
          bottle_id?: string
          corrects_event_id?: string | null
          created_at?: string
          device_id?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          occurred_at?: string
          received_at?: string
          reverses_event_id?: string | null
          source?: string
          user_id?: string
          volume_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hydration_events_bottle_owner_fk"
            columns: ["bottle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bottles"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "hydration_events_correction_owner_fk"
            columns: ["corrects_event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "hydration_events"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "hydration_events_device_owner_fk"
            columns: ["device_id", "user_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "hydration_events_reversed_event_owner_fk"
            columns: ["reverses_event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "hydration_events"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "hydration_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hydration_goals: {
        Row: {
          created_at: string
          daily_goal_ml: number
          effective_from: string
          effective_until: string | null
          id: string
          target_completion_time: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_goal_ml: number
          effective_from: string
          effective_until?: string | null
          id?: string
          target_completion_time?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          daily_goal_ml?: number
          effective_from?: string
          effective_until?: string | null
          id?: string
          target_completion_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hydration_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hydration_notification_preferences: {
        Row: {
          created_at: string
          pace_reminders_enabled: boolean
          reminder_frequency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pace_reminders_enabled?: boolean
          reminder_frequency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          pace_reminders_enabled?: boolean
          reminder_frequency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hydration_reminder_state: {
        Row: {
          behind_episode: number
          evaluated_pace_status: string | null
          evaluation_token: string | null
          last_evaluated_at: string | null
          last_pace_status: string | null
          last_reminder_attempted_at: string | null
          last_reminder_sent_at: string | null
          last_suppression_reason: string | null
          local_date: string | null
          next_eligible_at: string | null
          outbox_sequence: number
          pending_outbox_id: string | null
          reminder_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          behind_episode?: number
          evaluated_pace_status?: string | null
          evaluation_token?: string | null
          last_evaluated_at?: string | null
          last_pace_status?: string | null
          last_reminder_attempted_at?: string | null
          last_reminder_sent_at?: string | null
          last_suppression_reason?: string | null
          local_date?: string | null
          next_eligible_at?: string | null
          outbox_sequence?: number
          pending_outbox_id?: string | null
          reminder_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          behind_episode?: number
          evaluated_pace_status?: string | null
          evaluation_token?: string | null
          last_evaluated_at?: string | null
          last_pace_status?: string | null
          last_reminder_attempted_at?: string | null
          last_reminder_sent_at?: string | null
          last_suppression_reason?: string | null
          local_date?: string | null
          next_eligible_at?: string | null
          outbox_sequence?: number
          pending_outbox_id?: string | null
          reminder_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hydration_reminder_state_pending_outbox_fkey"
            columns: ["pending_outbox_id"]
            isOneToOne: false
            referencedRelation: "push_notification_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_friendly_code_reservations: {
        Row: {
          friendly_code: string
          reserved_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          friendly_code: string
          reserved_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          friendly_code?: string
          reserved_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_friendly_code_reservations_tag_owner_fk"
            columns: ["tag_id", "user_id"]
            isOneToOne: false
            referencedRelation: "nfc_tags"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "nfc_friendly_code_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_tags: {
        Row: {
          bottle_id: string
          created_at: string
          friendly_code: string | null
          id: string
          label: string | null
          last_scanned_at: string | null
          status: string
          token_hash: string
          user_id: string
        }
        Insert: {
          bottle_id: string
          created_at?: string
          friendly_code?: string | null
          id?: string
          label?: string | null
          last_scanned_at?: string | null
          status?: string
          token_hash: string
          user_id: string
        }
        Update: {
          bottle_id?: string
          created_at?: string
          friendly_code?: string | null
          id?: string
          label?: string | null
          last_scanned_at?: string | null
          status?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_tags_bottle_owner_fk"
            columns: ["bottle_id", "user_id"]
            isOneToOne: false
            referencedRelation: "bottles"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "nfc_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferred_unit: string
          target_completion_time: string | null
          timezone: string
          updated_at: string
          wake_time: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferred_unit?: string
          target_completion_time?: string | null
          timezone?: string
          updated_at?: string
          wake_time?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_unit?: string
          target_completion_time?: string | null
          timezone?: string
          updated_at?: string
          wake_time?: string | null
        }
        Relationships: []
      }
      push_notification_outbox: {
        Row: {
          accepted_subscription_ids: string[]
          attempts: number
          available_at: string
          claim_token: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string
          delivered_at: string | null
          id: string
          last_error_code: string | null
          local_date: string
          notification: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_subscription_ids?: string[]
          attempts?: number
          available_at?: string
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key: string
          delivered_at?: string | null
          id?: string
          last_error_code?: string | null
          local_date: string
          notification: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_subscription_ids?: string[]
          attempts?: number
          available_at?: string
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string
          delivered_at?: string | null
          id?: string
          last_error_code?: string | null
          local_date?: string
          notification?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          endpoint_hash: string
          expires_at: string | null
          failure_count: number
          id: string
          last_success_at: string | null
          p256dh: string
          platform: string | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          endpoint_hash: string
          expires_at?: string | null
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh: string
          platform?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          endpoint_hash?: string
          expires_at?: string | null
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string
          platform?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_pilot_nfc_tag: {
        Args: { p_token_hash: string }
        Returns: {
          bottle_id: string
          created_at: string
          friendly_code: string | null
          id: string
          label: string | null
          last_scanned_at: string | null
          status: string
          token_hash: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "nfc_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_push_reminder_evaluation: {
        Args: {
          p_body?: string
          p_evaluation_token: string
          p_next_eligible_at?: string
          p_now?: string
          p_pace_status: string
          p_reason?: string
          p_should_send: boolean
          p_title?: string
          p_user_id: string
          p_worker_secret: string
        }
        Returns: Json
      }
      build_community_member_summary: {
        Args: { p_user_id: string }
        Returns: Json
      }
      change_hydration_recording: {
        Args: {
          p_action: string
          p_event_id: string
          p_idempotency_key: string
          p_occurred_at?: string
          p_volume_ml?: number
        }
        Returns: Json
      }
      check_community_username_availability: {
        Args: { p_username: string }
        Returns: Json
      }
      claim_push_notification_outbox: {
        Args: { p_limit?: number; p_now?: string; p_worker_secret: string }
        Returns: Json
      }
      claim_push_reminder_evaluations: {
        Args: { p_limit?: number; p_now?: string; p_worker_secret: string }
        Returns: Json
      }
      community_member_daily_aggregate: {
        Args: { p_end_date: string; p_start_date: string; p_user_id: string }
        Returns: {
          completed_bottles: number
          goal_ml: number
          hydration_day: string
          intake_ml: number
        }[]
      }
      complete_push_notification_outbox: {
        Args: {
          p_accepted_count: number
          p_claim_token: string
          p_error_code?: string
          p_now?: string
          p_outbox_id: string
          p_permanent_failure_subscription_ids?: string[]
          p_retry_at?: string
          p_success_subscription_ids?: string[]
          p_worker_secret: string
        }
        Returns: Json
      }
      create_nfc_tag: {
        Args: {
          p_bottle_id: string
          p_friendly_code?: string
          p_label?: string
          p_token_hash: string
        }
        Returns: {
          bottle_id: string
          created_at: string
          friendly_code: string | null
          id: string
          label: string | null
          last_scanned_at: string | null
          status: string
          token_hash: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "nfc_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_physical_button_device: {
        Args: {
          p_bottle_id: string
          p_credential_hash: string
          p_label: string
        }
        Returns: Json
      }
      get_community_member_summary: {
        Args: { p_username: string }
        Returns: Json
      }
      get_my_community_profile: { Args: never; Returns: Json }
      get_physical_button_status: {
        Args: { p_api_secret: string; p_credential_hash: string }
        Returns: Json
      }
      get_push_reminder_diagnostics: { Args: never; Returns: Json }
      is_valid_timezone: { Args: { timezone_name: string }; Returns: boolean }
      list_community_member_summaries: {
        Args: { p_limit?: number; p_search?: string }
        Returns: Json
      }
      list_physical_button_devices: { Args: never; Returns: Json }
      mark_nfc_tag_confirmed: {
        Args: { p_event_id: string; p_tag_id: string }
        Returns: string
      }
      physical_button_api_is_authorized: {
        Args: { p_api_secret: string }
        Returns: boolean
      }
      physical_button_safe_metadata: {
        Args: { p_device: Database["public"]["Tables"]["devices"]["Row"] }
        Returns: Json
      }
      physical_button_status_state: {
        Args: { p_device_id: string; p_now: string; p_user_id: string }
        Returns: Json
      }
      process_hydration_event: {
        Args: {
          p_bottle_id: string
          p_device_id?: string
          p_event_type: string
          p_idempotency_key: string
          p_occurred_at: string
          p_reverses_event_id?: string
          p_source: string
          p_volume_ml?: number
        }
        Returns: Json
      }
      push_worker_is_authorized: {
        Args: { p_worker_secret: string }
        Returns: boolean
      }
      record_physical_button_hydration: {
        Args: {
          p_api_secret: string
          p_credential_hash: string
          p_idempotency_key: string
          p_occurred_at: string
        }
        Returns: Json
      }
      register_web_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_expires_at: string
          p_p256dh: string
          p_platform: string
          p_user_agent: string
        }
        Returns: Json
      }
      revoke_nfc_tag: {
        Args: { p_tag_id: string }
        Returns: {
          bottle_id: string
          created_at: string
          friendly_code: string | null
          id: string
          label: string | null
          last_scanned_at: string | null
          status: string
          token_hash: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "nfc_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_physical_button_device: {
        Args: { p_device_id: string }
        Returns: Json
      }
      rotate_nfc_tag: {
        Args: { p_tag_id: string; p_token_hash: string }
        Returns: {
          bottle_id: string
          created_at: string
          friendly_code: string | null
          id: string
          label: string | null
          last_scanned_at: string | null
          status: string
          token_hash: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "nfc_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_community_profile: {
        Args: { p_is_visible: boolean; p_username: string }
        Returns: Json
      }
      save_onboarding: {
        Args: {
          p_bottle_brand: string
          p_bottle_capacity_ml: number
          p_bottle_id?: string
          p_bottle_is_primary: boolean
          p_bottle_model: string
          p_bottle_name: string
          p_bottle_typical_fill_ml?: number
          p_daily_goal_ml: number
          p_display_name: string
          p_pilot_token_hash?: string
          p_preferred_unit: string
          p_target_completion_time: string
          p_timezone: string
          p_wake_time: string
        }
        Returns: string
      }
      set_hydration_notification_preferences: {
        Args: {
          p_pace_reminders_enabled: boolean
          p_reminder_frequency?: string
        }
        Returns: Json
      }
      update_nfc_tag: {
        Args: {
          p_bottle_id: string
          p_friendly_code: string
          p_label: string
          p_tag_id: string
        }
        Returns: {
          bottle_id: string
          created_at: string
          friendly_code: string | null
          id: string
          label: string | null
          last_scanned_at: string | null
          status: string
          token_hash: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "nfc_tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_physical_button_device: {
        Args: { p_bottle_id: string; p_device_id: string; p_label: string }
        Returns: Json
      }
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
