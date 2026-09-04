import Link from "next/link";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  createPhysicalDeviceManagementClient,
  getPhysicalDeviceList,
} from "@/lib/infrastructure/supabase/physical-devices";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { parseVolumeUnit } from "@/lib/units/volume";

import { PhysicalDeviceManager } from "./physical-device-manager";

export const dynamic = "force-dynamic";

export default async function PhysicalButtonPage() {
  await connection();

  const user = await requireAllowedUser("/device/button");
  const queryClient = await createClient();
  const [{ data: profile }, list] = await Promise.all([
    queryClient
      .from("profiles")
      .select("preferred_unit, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    getPhysicalDeviceList(
      await createPhysicalDeviceManagementClient(),
      queryClient,
      user.id,
    ),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Physical hardware"
        title="HydroPOP buttons"
        description="Create a dedicated, revocable credential and assign each physical button to one active bottle."
      />
      <Link
        href="/device"
        className="text-brand-primary mt-5 inline-flex text-sm font-bold"
      >
        ← Back to devices
      </Link>
      <PhysicalDeviceManager
        initialList={list}
        timezone={profile?.timezone ?? "America/New_York"}
        unit={parseVolumeUnit(profile?.preferred_unit)}
      />
    </>
  );
}
