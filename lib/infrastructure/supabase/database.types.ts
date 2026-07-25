export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRow = {
  created_at: string;
  display_name: string | null;
  id: string;
  preferred_unit: "ml" | "oz";
  target_completion_time: string | null;
  timezone: string;
  updated_at: string;
  wake_time: string | null;
};

type BottleRow = {
  archived_at: string | null;
  brand: string | null;
  capacity_ml: number;
  created_at: string;
  id: string;
  is_primary: boolean;
  model: string | null;
  name: string;
  updated_at: string;
  user_id: string;
};

type HydrationGoalRow = {
  created_at: string;
  daily_goal_ml: number;
  effective_from: string;
  effective_until: string | null;
  id: string;
  target_completion_time: string | null;
  user_id: string;
};

type NfcTagRow = {
  bottle_id: string;
  created_at: string;
  id: string;
  label: string | null;
  last_scanned_at: string | null;
  status: string;
  token_hash: string;
  user_id: string;
};

type DeviceRow = {
  battery_percent: number | null;
  bottle_id: string | null;
  created_at: string;
  device_type: string;
  firmware_version: string | null;
  id: string;
  last_seen_at: string | null;
  last_synced_at: string | null;
  name: string;
  status: string;
  updated_at: string;
  user_id: string;
};

type HydrationEventRow = {
  bottle_id: string;
  created_at: string;
  device_id: string | null;
  event_type: string;
  id: string;
  idempotency_key: string;
  metadata: Json;
  occurred_at: string;
  received_at: string;
  reverses_event_id: string | null;
  source: string;
  user_id: string;
  volume_ml: number | null;
};

export type Database = {
  public: {
    Tables: {
      bottles: {
        Row: BottleRow;
        Insert: {
          archived_at?: string | null;
          brand?: string | null;
          capacity_ml: number;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          model?: string | null;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<BottleRow>;
        Relationships: [];
      };
      devices: {
        Row: DeviceRow;
        Insert: {
          battery_percent?: number | null;
          bottle_id?: string | null;
          created_at?: string;
          device_type: string;
          firmware_version?: string | null;
          id?: string;
          last_seen_at?: string | null;
          last_synced_at?: string | null;
          name: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<DeviceRow>;
        Relationships: [];
      };
      hydration_events: {
        Row: HydrationEventRow;
        Insert: {
          bottle_id: string;
          created_at?: string;
          device_id?: string | null;
          event_type: string;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          occurred_at: string;
          received_at?: string;
          reverses_event_id?: string | null;
          source: string;
          user_id: string;
          volume_ml?: number | null;
        };
        Update: Partial<HydrationEventRow>;
        Relationships: [];
      };
      hydration_goals: {
        Row: HydrationGoalRow;
        Insert: {
          created_at?: string;
          daily_goal_ml: number;
          effective_from: string;
          effective_until?: string | null;
          id?: string;
          target_completion_time?: string | null;
          user_id: string;
        };
        Update: Partial<HydrationGoalRow>;
        Relationships: [];
      };
      nfc_tags: {
        Row: NfcTagRow;
        Insert: {
          bottle_id: string;
          created_at?: string;
          id?: string;
          label?: string | null;
          last_scanned_at?: string | null;
          status?: string;
          token_hash: string;
          user_id: string;
        };
        Update: Partial<NfcTagRow>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          preferred_unit?: "ml" | "oz";
          target_completion_time?: string | null;
          timezone?: string;
          updated_at?: string;
          wake_time?: string | null;
        };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      save_onboarding: {
        Args: {
          p_bottle_brand: string;
          p_bottle_capacity_ml: number;
          p_bottle_id: string | null;
          p_bottle_is_primary: boolean;
          p_bottle_model: string;
          p_bottle_name: string;
          p_daily_goal_ml: number;
          p_display_name: string;
          p_preferred_unit: "ml" | "oz";
          p_target_completion_time: string;
          p_timezone: string;
          p_wake_time: string;
        };
        Returns: string;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
