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
      devices: {
        Row: {
          battery_percent: number | null
          bottle_id: string | null
          created_at: string
          device_type: string
          firmware_version: string | null
          id: string
          last_seen_at: string | null
          last_synced_at: string | null
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          battery_percent?: number | null
          bottle_id?: string | null
          created_at?: string
          device_type: string
          firmware_version?: string | null
          id?: string
          last_seen_at?: string | null
          last_synced_at?: string | null
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          battery_percent?: number | null
          bottle_id?: string | null
          created_at?: string
          device_type?: string
          firmware_version?: string | null
          id?: string
          last_seen_at?: string | null
          last_synced_at?: string | null
          name?: string
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
      nfc_tags: {
        Row: {
          bottle_id: string
          created_at: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_valid_timezone: { Args: { timezone_name: string }; Returns: boolean }
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
          p_preferred_unit: string
          p_target_completion_time: string
          p_timezone: string
          p_wake_time: string
        }
        Returns: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
