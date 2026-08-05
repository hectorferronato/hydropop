import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getPublicSupabaseConfig } from "./public-env";

export function createPushWorkerClient() {
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createSupabaseClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
