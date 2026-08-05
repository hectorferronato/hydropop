import type { Database, Json } from "./database.types";

type NotificationPreferenceFunctions = Database["public"]["Functions"] & {
  set_hydration_notification_preferences: {
    Args: { p_pace_reminders_enabled: boolean };
    Returns: Json;
  };
};

/** Remove after the corrective migration is deployed and linked types regenerate. */
export type NotificationPreferencePendingDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: NotificationPreferenceFunctions;
  };
};
