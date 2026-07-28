import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  NfcBottleSummary,
  NfcTagList,
  NfcTagSummary,
} from "@/lib/contracts/nfc";
import type {
  NfcScanDataSource,
  ResolvedNfcBottle,
  ResolvedNfcTag,
} from "@/lib/application/nfc/resolve-nfc-scan";

import type { Database } from "./database.types";

type BottleRow = Database["public"]["Tables"]["bottles"]["Row"];
type TagRow = Database["public"]["Tables"]["nfc_tags"]["Row"];
type TagSummaryRow = Pick<
  TagRow,
  "bottle_id" | "created_at" | "id" | "label" | "last_scanned_at" | "status"
>;

type SafeQueryError = {
  code: string;
};

export class NfcReadError extends Error {
  constructor(resource: "bottles" | "tag" | "tags") {
    super(`Unable to load NFC ${resource}.`);
    this.name = "NfcReadError";
  }
}

function throwNfcReadError(
  resource: "bottles" | "tag" | "tags",
  error: SafeQueryError,
): never {
  console.error(`[HydroPOP] NFC ${resource} query failed.`, {
    code: error.code,
  });
  throw new NfcReadError(resource);
}

function toBottleSummary(bottle: BottleRow): NfcBottleSummary {
  return {
    brand: bottle.brand,
    capacityMl: bottle.capacity_ml,
    id: bottle.id,
    isPrimary: bottle.is_primary,
    model: bottle.model,
    name: bottle.name,
    normalFillMl: bottle.typical_fill_ml ?? bottle.capacity_ml,
    typicalFillMl: bottle.typical_fill_ml,
  };
}

export function toNfcTagSummary(
  tag: TagSummaryRow,
  bottle: BottleRow,
): NfcTagSummary {
  return {
    bottle: toBottleSummary(bottle),
    createdAt: tag.created_at,
    id: tag.id,
    label: tag.label,
    lastConfirmedAt: tag.last_scanned_at,
    status: tag.status,
  };
}

export async function getNfcTagList(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<NfcTagList> {
  const [tagsResult, bottlesResult] = await Promise.all([
    supabase
      .from("nfc_tags")
      .select("bottle_id, created_at, id, label, last_scanned_at, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bottles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (tagsResult.error) {
    throwNfcReadError("tags", tagsResult.error);
  }

  if (bottlesResult.error) {
    throwNfcReadError("bottles", bottlesResult.error);
  }

  const bottles = bottlesResult.data ?? [];
  const bottlesById = new Map(bottles.map((bottle) => [bottle.id, bottle]));
  const tags = (tagsResult.data ?? []).flatMap((tag) => {
    const bottle = bottlesById.get(tag.bottle_id);
    return bottle ? [toNfcTagSummary(tag, bottle)] : [];
  });

  return {
    assignableBottles: bottles
      .filter((bottle) => bottle.archived_at === null && bottle.is_primary)
      .map(toBottleSummary),
    tags,
  };
}

export async function getOwnedNfcTag(
  supabase: SupabaseClient<Database>,
  userId: string,
  tagId: string,
): Promise<TagSummaryRow | null> {
  const { data, error } = await supabase
    .from("nfc_tags")
    .select("bottle_id, created_at, id, label, last_scanned_at, status")
    .eq("id", tagId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throwNfcReadError("tag", error);
  }

  return data;
}

export async function getOwnedActiveBottle(
  supabase: SupabaseClient<Database>,
  userId: string,
  bottleId: string,
): Promise<BottleRow | null> {
  const { data, error } = await supabase
    .from("bottles")
    .select("*")
    .eq("id", bottleId)
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throwNfcReadError("bottles", error);
  }

  return data;
}

export function createNfcScanDataSource(
  supabase: SupabaseClient<Database>,
): NfcScanDataSource {
  return {
    async findBottle(userId, bottleId): Promise<ResolvedNfcBottle | null> {
      const bottle = await getOwnedActiveBottle(supabase, userId, bottleId);

      return bottle
        ? {
            archivedAt: bottle.archived_at,
            brand: bottle.brand,
            capacityMl: bottle.capacity_ml,
            id: bottle.id,
            isPrimary: bottle.is_primary,
            model: bottle.model,
            name: bottle.name,
            typicalFillMl: bottle.typical_fill_ml,
            userId: bottle.user_id,
          }
        : null;
    },
    async findTagByHash(userId, tokenHash): Promise<ResolvedNfcTag | null> {
      const { data, error } = await supabase
        .from("nfc_tags")
        .select("bottle_id, id, label, last_scanned_at, status, user_id")
        .eq("token_hash", tokenHash)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (error) {
        throwNfcReadError("tag", error);
      }

      return data
        ? {
            bottleId: data.bottle_id,
            id: data.id,
            label: data.label,
            lastConfirmedAt: data.last_scanned_at,
            status: data.status,
            userId: data.user_id,
          }
        : null;
    },
  };
}
