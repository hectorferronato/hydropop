import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { PilotPendingDatabase } from "./pilot-pending.types";
import { getPublicSupabaseConfig } from "./public-env";

export async function createOnboardingRpcClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createServerClient<PilotPendingDatabase>(url, publishableKey, {
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
          // Server Actions can write cookies; Server Components rely on proxy refresh.
        }
      },
    },
  });
}
