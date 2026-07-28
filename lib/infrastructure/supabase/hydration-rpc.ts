import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { ProcessHydrationEventArguments } from "@/lib/application/hydration/process-hydration-event";

import { getPublicSupabaseConfig } from "./public-env";

type HydrationRpcDatabase = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      process_hydration_event: {
        Args: ProcessHydrationEventArguments;
        Returns: unknown;
      };
    };
  };
};

export async function createHydrationRpcClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createServerClient<HydrationRpcDatabase>(url, publishableKey, {
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
          // Route handlers can write cookies; Server Components use proxy refresh.
        }
      },
    },
  });
}
