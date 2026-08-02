import type { SaveOnboardingArguments } from "@/lib/application/onboarding/save-onboarding";

import type { Database } from "./database.types";

type NfcTagRow = Database["public"]["Tables"]["nfc_tags"]["Row"];

type PilotFunctions = Database["public"]["Functions"] & {
  activate_pilot_nfc_tag: {
    Args: { p_token_hash: string };
    Returns: NfcTagRow;
  };
  save_onboarding: {
    Args: SaveOnboardingArguments;
    Returns: string;
  };
};

export type PilotPendingDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: PilotFunctions;
  };
};
