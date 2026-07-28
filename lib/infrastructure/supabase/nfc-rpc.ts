import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./database.types";
import { getPublicSupabaseConfig } from "./public-env";

type TagRow = Database["public"]["Tables"]["nfc_tags"]["Row"];

type NfcRpcDatabase = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      create_nfc_tag: {
        Args: {
          p_bottle_id: string;
          p_label?: string;
          p_token_hash: string;
        };
        Returns: TagRow;
      };
      mark_nfc_tag_confirmed: {
        Args: {
          p_event_id: string;
          p_tag_id: string;
        };
        Returns: string;
      };
      revoke_nfc_tag: {
        Args: {
          p_tag_id: string;
        };
        Returns: TagRow;
      };
      rotate_nfc_tag: {
        Args: {
          p_tag_id: string;
          p_token_hash: string;
        };
        Returns: TagRow;
      };
      update_nfc_tag: {
        Args: {
          p_bottle_id: string;
          p_label: string;
          p_tag_id: string;
        };
        Returns: TagRow;
      };
    };
  };
};

export async function createNfcRpcClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getPublicSupabaseConfig();

  return createServerClient<NfcRpcDatabase>(url, publishableKey, {
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
