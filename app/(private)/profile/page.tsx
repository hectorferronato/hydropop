import type { Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { FormSubmitButton } from "@/components/form-submit-button";
import { SoundEffectsPreference } from "@/components/sound-effects-preference";
import {
  DeviceIcon,
  DropIcon,
  CommunityIcon,
  ProfileIcon,
  SettingsIcon,
} from "@/components/icons";
import { buildPrivateProfileSummary } from "@/lib/application/analytics/hydration-analytics";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getHydrationSnapshot } from "@/lib/infrastructure/supabase/hydration";
import { getMyCommunityProfile } from "@/lib/infrastructure/supabase/community";
import { createClient } from "@/lib/infrastructure/supabase/server";
import { formatDisplayVolume } from "@/lib/units/volume";

function formatMemberSince(value: string | null): string {
  if (!value) {
    return "Pilot member";
  }

  return `Member since ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value))}`;
}

const managementLinks = [
  {
    description: "Choose devices and opt in to supportive pace reminders.",
    href: "/settings/notifications",
    icon: SettingsIcon,
    label: "Notification settings",
    section: "Account",
  },
  {
    description: "Review or change your date-effective daily target.",
    href: "/settings/hydration",
    icon: DropIcon,
    label: "Hydration goal settings",
    section: "Hydration",
  },
  {
    description: "Update the active bottle and normal completion amount.",
    href: "/settings/bottle",
    icon: DropIcon,
    label: "Bottle settings",
    section: "Bottle",
  },
  {
    description: "Manage the NFC tags assigned to your bottles.",
    href: "/device/nfc",
    icon: DeviceIcon,
    label: "NFC and devices",
    section: "Devices",
  },
  {
    description: "Update your name, timezone, schedule, and display unit.",
    href: "/settings/profile",
    icon: ProfileIcon,
    label: "Profile settings",
    section: "Account",
  },
  {
    description: "Review all current HydroPOP configuration.",
    href: "/settings",
    icon: SettingsIcon,
    label: "Settings overview",
    section: "Account",
  },
] as const;

export default async function ProfilePage() {
  await connection();

  const user = await requireAllowedUser("/profile");
  const [hydrationSnapshot, communityProfile] = await Promise.all([
    getHydrationSnapshot(await createClient(), user.id),
    getMyCommunityProfile(),
  ]);
  const profile = buildPrivateProfileSummary(hydrationSnapshot, new Date());
  const unit = profile.preferredUnit;

  return (
    <>
      <section className="border-brand-secondary/5 rounded-[2rem] border bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="flex items-start gap-4 sm:items-center">
          <div className="bg-brand-primary flex size-16 shrink-0 items-center justify-center rounded-[1.5rem] text-xl font-bold text-white shadow-lg shadow-[rgba(62,41,255,0.2)]">
            {profile.initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
                Private profile
              </p>
              <span className="bg-brand-primary/8 text-brand-primary rounded-full px-2.5 py-1 text-[0.65rem] font-bold">
                Pilot
              </span>
            </div>
            <h1 className="text-brand-secondary mt-2 truncate text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
              {profile.displayName || "HydroPOP member"}
            </h1>
            <p className="text-brand-secondary/45 mt-1 text-xs">
              {formatMemberSince(profile.memberSince)}
            </p>
          </div>
        </div>
        <p className="text-brand-secondary/55 mt-5 max-w-xl text-sm leading-6">
          Your account settings and lifetime statistics remain private. Only a
          limited hydration summary is shared if you explicitly join Community.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:max-w-xl">
          <div className="bg-brand-background rounded-2xl p-3">
            <dt className="text-brand-secondary/40 text-xs font-bold uppercase">
              Display unit
            </dt>
            <dd className="text-brand-secondary mt-1 text-sm font-bold uppercase">
              {unit}
            </dd>
          </div>
          <div className="bg-brand-background min-w-0 rounded-2xl p-3">
            <dt className="text-brand-secondary/40 text-xs font-bold uppercase">
              Timezone
            </dt>
            <dd className="text-brand-secondary mt-1 truncate text-sm font-bold">
              {profile.timezone}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-7">
        <h2 className="text-brand-secondary text-xl font-bold">
          Your hydration summary
        </h2>
        {profile.activeDayCount === 0 ? (
          <div className="border-brand-secondary/5 mt-4 rounded-[1.75rem] border bg-white/80 p-5">
            <p className="text-brand-secondary font-bold">
              Record your first bottle to build your private summary.
            </p>
            <p className="text-brand-secondary/50 mt-2 text-sm leading-6">
              Lifetime hydration, averages, completed bottles, and goal streaks
              will appear from real event history.
            </p>
          </div>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            {
              label: "Lifetime hydration",
              value: `${formatDisplayVolume(
                profile.lifetimeHydrationMl,
                unit,
              )} ${unit}`,
            },
            {
              label: "Completed bottles",
              value: String(profile.totalCompletedBottles),
            },
            {
              label: "Goal days",
              value: String(profile.daysGoalMet),
            },
            {
              label: "Current goal streak",
              value: `${profile.currentGoalStreak} days`,
            },
            {
              label: "Best goal streak",
              value: `${profile.bestGoalStreak} days`,
            },
            {
              label: "Daily average",
              value:
                profile.averageDailyIntakeMl === null
                  ? "Not available yet"
                  : `${formatDisplayVolume(
                      profile.averageDailyIntakeMl,
                      unit,
                    )} ${unit}/day`,
            },
          ].map((statistic) => (
            <div
              key={statistic.label}
              className="border-brand-secondary/5 min-w-0 rounded-2xl border bg-white/85 p-4"
            >
              <dt className="text-brand-secondary/40 text-[0.68rem] font-bold uppercase">
                {statistic.label}
              </dt>
              <dd className="text-brand-secondary mt-2 text-sm font-bold">
                {statistic.value}
              </dd>
            </div>
          ))}
        </dl>
        {profile.activeDayCount > 0 ? (
          <p className="text-brand-secondary/40 mt-3 text-xs leading-5">
            The daily average includes zero-intake local dates across{" "}
            {profile.activeDayCount} active day
            {profile.activeDayCount === 1 ? "" : "s"}, beginning with your first
            recorded hydration day.
          </p>
        ) : null}
      </section>

      <SoundEffectsPreference />

      <section className="border-brand-secondary/5 mt-7 rounded-[1.75rem] border bg-white/85 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="bg-brand-primary/8 text-brand-primary flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <CommunityIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-brand-primary text-[0.65rem] font-bold tracking-[0.12em] uppercase">
              Community
            </p>
            {communityProfile ? (
              <>
                <h2 className="text-brand-secondary mt-1 text-lg font-bold">
                  @{communityProfile.username}
                </h2>
                <p className="text-brand-secondary/50 mt-1 text-sm">
                  {communityProfile.isVisible
                    ? "Visible to signed-in HydroPOP members"
                    : "Hidden from other Community members"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/u/${communityProfile.username}` as Route}
                    className="bg-brand-primary inline-flex h-10 items-center rounded-xl px-3 text-xs font-bold text-white"
                  >
                    View my community profile
                  </Link>
                  <Link
                    href={"/settings/community" as Route}
                    className="border-brand-primary/15 text-brand-primary inline-flex h-10 items-center rounded-xl border px-3 text-xs font-bold"
                  >
                    Community settings
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-brand-secondary mt-1 text-lg font-bold">
                  Join Community
                </h2>
                <p className="text-brand-secondary/50 mt-1 text-sm leading-6">
                  Create an optional member identity and share only a limited
                  hydration summary with signed-in friends and family.
                </p>
                <Link
                  href="/community"
                  className="bg-brand-primary mt-4 inline-flex h-10 items-center rounded-xl px-3 text-xs font-bold text-white"
                >
                  Join Community
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="text-brand-secondary/40 mt-4 text-xs leading-5">
          /profile is your private account and lifetime summary. /u/username is
          a limited member-facing Community profile.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-brand-secondary text-xl font-bold">
          Manage HydroPOP
        </h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {managementLinks.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href as Route}
                className="border-brand-secondary/5 flex min-h-20 items-center gap-4 rounded-2xl border bg-white/85 p-4"
              >
                <span className="bg-brand-primary/8 text-brand-primary flex size-11 shrink-0 items-center justify-center rounded-2xl">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-brand-primary text-[0.62rem] font-bold uppercase">
                    {item.section}
                  </span>
                  <span className="text-brand-secondary mt-0.5 block text-sm font-bold">
                    {item.label}
                  </span>
                  <span className="text-brand-secondary/45 mt-1 block text-xs leading-5">
                    {item.description}
                  </span>
                </span>
                <span aria-hidden="true" className="ml-auto">
                  →
                </span>
              </Link>
            );
          })}
        </div>
        <form action="/auth/logout" method="post" className="mt-4">
          <FormSubmitButton
            pendingLabel="Logging out…"
            className="border-brand-secondary/10 text-brand-secondary h-12 w-full rounded-2xl border bg-white px-5 text-sm font-bold sm:w-auto"
          >
            Log out
          </FormSubmitButton>
        </form>
      </section>
    </>
  );
}
