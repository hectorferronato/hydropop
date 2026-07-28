import type { Database as LinkedDatabase } from "./database.types";

type LinkedBottleTable = LinkedDatabase["public"]["Tables"]["bottles"];

type PendingBottleTable = {
  Insert: LinkedBottleTable["Insert"] & {
    typical_fill_ml?: number | null;
  };
  Relationships: LinkedBottleTable["Relationships"];
  Row: LinkedBottleTable["Row"] & {
    typical_fill_ml: number | null;
  };
  Update: LinkedBottleTable["Update"] & {
    typical_fill_ml?: number | null;
  };
};

/**
 * Strict overlay for forward migrations that are intentionally not deployed
 * yet. Delete this overlay after the linked types are regenerated post-push.
 * The generated database.types.ts file must never be edited by hand.
 */
export type PendingDatabase = Omit<LinkedDatabase, "public"> & {
  public: Omit<LinkedDatabase["public"], "Tables"> & {
    Tables: Omit<LinkedDatabase["public"]["Tables"], "bottles"> & {
      bottles: PendingBottleTable;
    };
  };
};
