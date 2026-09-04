import type { Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DeviceIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getNfcTagList } from "@/lib/infrastructure/supabase/nfc";
import { createNfcClient } from "@/lib/infrastructure/supabase/nfc-rpc";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { formatDisplayVolume, parseVolumeUnit } from "@/lib/units/volume";

function displayTime(value: string | null, timezone: string): string {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(new Date(value))
    : "Never";
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-brand-secondary/5 flex justify-between gap-4 border-b py-3 last:border-b-0">
      <dt className="text-brand-secondary/45 text-sm">{label}</dt>
      <dd className="text-brand-secondary text-right text-sm font-bold">
        {value}
      </dd>
    </div>
  );
}

export default async function DevicePage() {
  await connection();

  const user = await requireAllowedUser("/device");
  const supabase = await createClient();
  const [{ data: profile }, list] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferred_unit, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    getNfcTagList(await createNfcClient(), user.id),
  ]);
  const unit = parseVolumeUnit(profile?.preferred_unit);
  const timezone = profile?.timezone ?? "America/New_York";
  const activeTag = list.tags.find((tag) => tag.status === "active") ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Connections"
        title="Device"
        description="Manage secure NFC and physical HydroPOP button connections."
      />

      <section className="border-brand-secondary/5 mt-8 rounded-[2rem] border bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="bg-brand-primary/10 text-brand-primary flex size-12 shrink-0 items-center justify-center rounded-2xl">
            <DeviceIcon className="size-6" />
          </span>
          <div>
            <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
              Physical button
            </p>
            <h2 className="text-brand-secondary mt-1 text-xl font-bold">
              Secure hardware credentials
            </h2>
            <p className="text-brand-secondary/50 mt-2 max-w-2xl text-sm leading-6">
              Assign a real HydroPOP button to one active bottle, copy its
              dedicated token once, and revoke access at any time.
            </p>
          </div>
        </div>
        <Link
          href={"/device/button" as Route}
          className="bg-brand-primary mt-7 inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white"
        >
          Manage physical buttons
        </Link>
      </section>

      <section className="border-brand-secondary/5 mt-8 rounded-[2rem] border bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="flex items-start gap-4">
          <span className="bg-brand-primary/10 text-brand-primary flex size-12 shrink-0 items-center justify-center rounded-2xl">
            <DeviceIcon className="size-6" />
          </span>
          <div>
            <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
              NFC prototype
            </p>
            <h2 className="text-brand-secondary mt-1 text-xl font-bold">
              {activeTag ? "Your NFC tag is active" : "Set up an NFC tag"}
            </h2>
            <p className="text-brand-secondary/50 mt-2 max-w-2xl text-sm leading-6">
              Finish your normal bottle amount, scan the tag, and confirm once.
              This prototype does not use Bluetooth and does not pretend that a
              physical HydroPOP Charm is connected.
            </p>
          </div>
        </div>

        <dl className="mt-6">
          <OverviewRow
            label="NFC tag status"
            value={activeTag ? "Active" : "Not configured"}
          />
          <OverviewRow
            label="Assigned bottle"
            value={activeTag?.bottle.name ?? "None"}
          />
          <OverviewRow
            label="Bottle capacity"
            value={
              activeTag
                ? `${formatDisplayVolume(
                    activeTag.bottle.capacityMl,
                    unit,
                  )} ${unit}`
                : "Not available"
            }
          />
          <OverviewRow
            label="Records per completion"
            value={
              activeTag
                ? `${formatDisplayVolume(
                    activeTag.bottle.normalFillMl,
                    unit,
                  )} ${unit}${
                    activeTag.bottle.typicalFillMl === null
                      ? " — uses full capacity"
                      : ""
                  }`
                : "Not available"
            }
          />
          <OverviewRow
            label="Last confirmed use"
            value={displayTime(activeTag?.lastConfirmedAt ?? null, timezone)}
          />
        </dl>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/device/nfc"
            className="bg-brand-primary hover:bg-brand-primary/90 inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white transition"
          >
            {list.tags.length > 0 ? "Manage NFC tags" : "Create NFC tag"}
          </Link>
          {list.tags.length > 0 ? (
            <Link
              href="/device/nfc"
              className="border-brand-secondary/10 text-brand-secondary inline-flex h-12 items-center justify-center rounded-2xl border bg-white px-5 text-sm font-bold"
            >
              Set up another tag
            </Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
