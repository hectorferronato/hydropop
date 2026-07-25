import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "./public-env";

export function createClient() {
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createBrowserClient(url, publishableKey);
}
