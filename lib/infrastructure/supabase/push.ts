import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "./public-env";
import type { PushPendingDatabase } from "./push-pending.types";

export function createPushWorkerClient() {
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createSupabaseClient<PushPendingDatabase>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
