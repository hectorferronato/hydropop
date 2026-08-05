import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { NotificationPreferencePendingDatabase } from "./notification-preference-pending.types";
import { getPublicSupabaseConfig } from "./public-env";

export async function createPushServerClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createServerClient<NotificationPreferencePendingDatabase>(
    url,
    publishableKey,
    {
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
            // Server Components cannot write cookies. The proxy refreshes them.
          }
        },
      },
    },
  );
}
