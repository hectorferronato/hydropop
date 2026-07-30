import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { CommunityPendingDatabase } from "./community-pending.types";
import { getPublicSupabaseConfig } from "./public-env";

export async function createCommunityRpcClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createServerClient<CommunityPendingDatabase>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components use the session-refresh proxy for cookie writes.
        }
      },
    },
  });
}
