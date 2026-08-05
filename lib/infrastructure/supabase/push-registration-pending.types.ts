import type { Database, Json } from "./database.types";

type PushRegistrationFunctions = Database["public"]["Functions"] & {
  register_web_push_subscription: {
    Args: {
      p_auth: string;
      p_endpoint: string;
      p_expires_at: string | null;
      p_p256dh: string;
      p_platform: string | null;
      p_user_agent: string | null;
    };
    Returns: Json;
  };
};

/** Remove after the corrective migration is deployed and linked types regenerate. */
export type PushRegistrationPendingDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: PushRegistrationFunctions;
  };
};
