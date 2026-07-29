import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Brand } from "@/components/brand";
import { DropIcon } from "@/components/icons";
import { getTodayDashboard } from "@/lib/application/hydration/get-today-dashboard";
import { resolveNfcScan } from "@/lib/application/nfc/resolve-nfc-scan";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createNfcScanDataSource } from "@/lib/infrastructure/supabase/nfc";
import { createNfcClient } from "@/lib/infrastructure/supabase/nfc-rpc";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { formatDisplayVolume } from "@/lib/units/volume";

import { NfcConfirmation } from "./nfc-confirmation";

export const metadata: Metadata = {
  title: "Record one bottle",
};

function UnavailableNfcTag() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/90 p-7 text-center shadow-[0_30px_100px_rgba(62,41,255,0.14)] sm:p-10">
        <div className="bg-brand-secondary/8 text-brand-secondary/45 mx-auto flex size-16 items-center justify-center rounded-3xl">
          <DropIcon className="size-8" />
        </div>
        <h1 className="text-brand-secondary mt-7 text-3xl font-bold tracking-[-0.035em]">
          This NFC tag is unavailable
        </h1>
        <p className="text-brand-secondary/55 mx-auto mt-4 max-w-sm text-sm leading-6">
          The link may be invalid, revoked, assigned elsewhere, or connected to
          a bottle that is no longer active.
        </p>
        <Link
          href="/device/nfc"
          className="bg-brand-primary hover:bg-brand-primary/90 mt-7 inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white"
        >
          Manage NFC tags
        </Link>
      </section>
    </main>
  );
}

export default async function NfcIdentifierPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  await connection();

  const { identifier } = await params;
  const destination = `/t/${encodeURIComponent(identifier)}` as Route;
  const user = await requireAllowedUser(destination);
  const supabase = await createClient();
  const onboarding = await getOnboardingSnapshot(supabase, user.id);

  if (!onboarding.isComplete) {
    redirect(
      onboarding.status.hasStartedConfiguration ? "/settings" : "/setup",
    );
  }

  const resolution = await resolveNfcScan(
    createNfcScanDataSource(await createNfcClient()),
    user.id,
    identifier,
  );

  if (!resolution) {
    return <UnavailableNfcTag />;
  }

  const dashboard = await getTodayDashboard(supabase, user.id, new Date());
  const unit = dashboard.preferredUnit;
  const bottleDescription = [resolution.bottle.brand, resolution.bottle.model]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-5 shadow-[0_30px_100px_rgba(62,41,255,0.14)] backdrop-blur sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <span className="bg-brand-primary/8 text-brand-primary rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-[0.12em] uppercase">
            NFC confirmation
          </span>
        </div>

        <div className="mt-8 text-center">
          <div className="bg-brand-primary mx-auto flex size-16 items-center justify-center rounded-3xl text-white shadow-lg shadow-[rgba(62,41,255,0.22)]">
            <DropIcon className="size-8" />
          </div>
          <h1 className="text-brand-secondary mt-5 text-3xl font-bold tracking-[-0.04em]">
            {dashboard.daySummary.completedBottleCount === 0
              ? "Completed a bottle?"
              : "Completed another bottle?"}
          </h1>
          <p className="text-brand-secondary mt-3 text-lg font-bold">
            {resolution.bottle.name}
          </p>
          {bottleDescription ? (
            <p className="text-brand-secondary/45 mt-1 text-xs">
              {bottleDescription}
            </p>
          ) : null}
        </div>

        <dl className="border-brand-secondary/5 bg-brand-bg mt-7 rounded-2xl border p-4 text-sm">
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-brand-secondary/45">Bottle capacity</dt>
            <dd className="text-brand-secondary font-bold">
              {formatDisplayVolume(resolution.bottle.capacityMl, unit)} {unit}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <dt className="text-brand-secondary/45">Records per completion</dt>
            <dd className="text-brand-secondary font-bold">
              {formatDisplayVolume(resolution.normalFillMl, unit)} {unit}
              {resolution.bottle.typicalFillMl === null
                ? " — uses full capacity"
                : ""}
            </dd>
          </div>
        </dl>

        <NfcConfirmation
          initialCompletedBottleCount={
            dashboard.daySummary.completedBottleCount
          }
          initialConsumedMl={dashboard.daySummary.consumedMl}
          initialGoalMl={dashboard.daySummary.goalMl}
          initialNextCheckpointAt={
            dashboard.coaching.nextCheckpoint?.targetAt ?? null
          }
          normalFillMl={resolution.normalFillMl}
          timezone={dashboard.profile.timezone}
          identifier={identifier}
          unit={unit}
        />

        <div className="border-brand-secondary/5 mt-6 border-t pt-5">
          <p className="text-brand-secondary/45 text-xs leading-5">
            This records your normal fill amount of{" "}
            {formatDisplayVolume(resolution.normalFillMl, unit)} {unit}. Partial
            fills must be corrected in the app. Loading or refreshing this page
            never records hydration.
          </p>
          <Link
            href="/today"
            className="text-brand-primary mt-4 inline-block text-sm font-bold"
          >
            View Today
          </Link>
        </div>
      </section>
    </main>
  );
}
