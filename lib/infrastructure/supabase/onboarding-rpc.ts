import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { SaveOnboardingArguments } from "@/lib/application/onboarding/save-onboarding";

import { getPublicSupabaseConfig } from "./public-env";

type OnboardingRpcDatabase = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      save_onboarding: {
        Args: SaveOnboardingArguments;
        Returns: string;
      };
    };
  };
};

export async function createOnboardingRpcClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createServerClient<OnboardingRpcDatabase>(url, publishableKey, {
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
