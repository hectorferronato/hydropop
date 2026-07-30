import { parseVolumeUnit, type VolumeUnit } from "@/lib/units/volume";

import { createClient } from "./server";

export type CommunityViewerProfile = {
  displayName: string;
  preferredUnit: VolumeUnit;
};

export async function getCommunityViewerProfile(
  userId: string,
): Promise<CommunityViewerProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, preferred_unit")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("[HydroPOP] Community viewer profile query failed.", {
      code: error.code,
    });
    throw new Error("Unable to load the Community viewer profile.");
  }

  return {
    displayName: data.display_name ?? "",
    preferredUnit: parseVolumeUnit(data.preferred_unit),
  };
}
