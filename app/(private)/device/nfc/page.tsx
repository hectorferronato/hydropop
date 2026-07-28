import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getNfcTagList } from "@/lib/infrastructure/supabase/nfc";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { parseVolumeUnit } from "@/lib/units/volume";

import { NfcManager } from "./nfc-manager";

export default async function NfcManagementPage() {
  await connection();

  const user = await requireAllowedUser("/device/nfc");
  const supabase = await createClient();
  const [{ data: profile }, list] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferred_unit, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    getNfcTagList(supabase, user.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Device · NFC prototype"
        title="Manage NFC tags"
        description="Create a private NFC URL, write it to a tag, and use an authenticated confirmation to record one normal bottle amount."
      />
      <NfcManager
        initialList={list}
        timezone={profile?.timezone ?? "America/New_York"}
        unit={parseVolumeUnit(profile?.preferred_unit)}
      />
    </>
  );
}
