import type { Database, Json } from "./database.types";

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type PushSubscriptionRow = {
  auth: string;
  created_at: string;
  endpoint: string;
  endpoint_hash: string;
  expires_at: string | null;
  failure_count: number;
  id: string;
  last_success_at: string | null;
  p256dh: string;
  platform: string | null;
  revoked_at: string | null;
  updated_at: string;
  user_agent: string | null;
  user_id: string;
};

type NotificationPreferenceRow = {
  created_at: string;
  pace_reminders_enabled: boolean;
  updated_at: string;
  user_id: string;
};

type PushTables = Database["public"]["Tables"] & {
  web_push_subscriptions: {
    Row: PushSubscriptionRow;
    Insert: Omit<
      PushSubscriptionRow,
      | "created_at"
      | "failure_count"
      | "id"
      | "last_success_at"
      | "revoked_at"
      | "updated_at"
    > &
      Partial<
        Pick<
          PushSubscriptionRow,
          | "created_at"
          | "failure_count"
          | "id"
          | "last_success_at"
          | "revoked_at"
          | "updated_at"
        >
      >;
    Update: Partial<PushSubscriptionRow>;
    Relationships: Relationship[];
  };
  hydration_notification_preferences: {
    Row: NotificationPreferenceRow;
    Insert: Pick<
      NotificationPreferenceRow,
      "pace_reminders_enabled" | "user_id"
    > &
      Partial<Pick<NotificationPreferenceRow, "created_at" | "updated_at">>;
    Update: Partial<NotificationPreferenceRow>;
    Relationships: Relationship[];
  };
};

type PushFunctions = Database["public"]["Functions"] & {
  apply_push_reminder_evaluation: {
    Args: {
      p_body?: string;
      p_evaluation_token: string;
      p_now?: string;
      p_pace_status: string;
      p_should_send: boolean;
      p_title?: string;
      p_user_id: string;
      p_worker_secret: string;
    };
    Returns: Json;
  };
  claim_push_notification_outbox: {
    Args: { p_limit?: number; p_now?: string; p_worker_secret: string };
    Returns: Json;
  };
  claim_push_reminder_evaluations: {
    Args: { p_limit?: number; p_now?: string; p_worker_secret: string };
    Returns: Json;
  };
  complete_push_notification_outbox: {
    Args: {
      p_accepted_count: number;
      p_claim_token: string;
      p_error_code?: string;
      p_now?: string;
      p_outbox_id: string;
      p_permanent_failure_subscription_ids?: string[];
      p_retry_at?: string;
      p_success_subscription_ids?: string[];
      p_worker_secret: string;
    };
    Returns: Json;
  };
};

export type PushPendingDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions" | "Tables"> & {
    Functions: PushFunctions;
    Tables: PushTables;
  };
};
