import type { Metadata } from "next";
import { connection } from "next/server";

import { DailyIntakeChart } from "@/app/(private)/trends/trend-charts";
import {
  formatCommunityVolume,
  getCommunityGoalPercentage,
  getCommunityInitials,
} from "@/lib/application/community/presentation";
import type { TrendDay } from "@/lib/contracts/trends";
import { validateCommunityUsername } from "@/lib/domain/community/username";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getCommunityMember } from "@/lib/infrastructure/supabase/community";
import { getCommunityViewerProfile } from "@/lib/infrastructure/supabase/community-viewer";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Community member · HydroPOP",
};

function formatMemberSince(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function MemberUnavailable() {
  return (
    <section className="border-brand-secondary/5 mx-auto max-w-2xl rounded-[2rem] border bg-white/90 p-6 text-center sm:p-8">
      <h1 className="text-brand-secondary text-2xl font-bold">
        Community member unavailable
      </h1>
      <p className="text-brand-secondary/55 mt-3 text-sm leading-6">
        This member profile cannot be viewed. It may be unavailable or not
        visible in Community.
      </p>
    </section>
  );
}

export default async function CommunityMemberPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await connection();

  const { username: rawUsername } = await params;
  const destination = `/u/${encodeURIComponent(rawUsername)}`;
  const user = await requireAllowedUser(destination);
  const validation = validateCommunityUsername(rawUsername);

  if (validation.error || !validation.username) {
    return <MemberUnavailable />;
  }

  const [member, viewer] = await Promise.all([
    getCommunityMember(validation.username),
    getCommunityViewerProfile(user.id),
  ]);

  if (!member) {
    return <MemberUnavailable />;
  }

  const unit = viewer.preferredUnit;
  const goalPercentage = getCommunityGoalPercentage(
    member.todayIntakeMl,
    member.todayGoalMl,
  );
  const progressWidth = Math.min(100, Math.max(0, goalPercentage ?? 0));
  const currentDate = member.daily.at(-1)?.date ?? "";
  const chartDays: TrendDay[] = member.daily.map((day) => ({
    change: null,
    date: day.date,
    goalMet: day.goalMl !== null && day.intakeMl >= day.goalMl,
    goalMl: day.goalMl,
    intakeMl: day.intakeMl,
  }));
  const hasHydration = member.daily.some((day) => day.intakeMl > 0);
  const completionPercentage =
    member.sevenDayEligibleDays === 0
      ? null
      : Math.round(
          (member.sevenDayGoalDays / member.sevenDayEligibleDays) * 100,
        );

  return (
    <>
      <section className="border-brand-secondary/5 rounded-[2rem] border bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <div className="bg-brand-primary flex size-16 shrink-0 items-center justify-center rounded-[1.5rem] text-lg font-bold text-white">
            {getCommunityInitials(member.displayName)}
          </div>
          <div className="min-w-0">
            <p className="text-brand-primary text-xs font-bold tracking-[0.12em] uppercase">
              HydroPOP community member
            </p>
            <h1 className="text-brand-secondary mt-1 truncate text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
              {member.displayName}
            </h1>
            <p className="text-brand-primary mt-1 truncate text-sm font-semibold">
              @{member.username}
            </p>
            <p className="text-brand-secondary/40 mt-1 text-xs">
              Member since {formatMemberSince(member.joinedAt)}
            </p>
          </div>
        </div>
      </section>

      <section className="border-brand-secondary/5 mt-6 rounded-[1.75rem] border bg-white/85 p-5 sm:p-6">
        <p className="text-brand-primary text-xs font-bold tracking-[0.12em] uppercase">
          Today
        </p>
        <h2 className="text-brand-secondary mt-2 text-xl font-bold">
          {member.todayIntakeMl === 0
            ? "No hydration recorded today."
            : `${formatCommunityVolume(member.todayIntakeMl, unit)} recorded`}
        </h2>
        {member.todayGoalMl === null ? (
          <p className="text-brand-secondary/50 mt-2 text-sm">
            No applicable daily goal is available.
          </p>
        ) : (
          <>
            <div
              role="progressbar"
              aria-label="Today’s hydration goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressWidth}
              className="bg-brand-primary/10 mt-5 h-3 overflow-hidden rounded-full"
            >
              <div
                className="bg-brand-primary h-full rounded-full"
                style={{ width: `${progressWidth}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
              <p className="text-brand-secondary/50">
                Goal: {formatCommunityVolume(member.todayGoalMl, unit)}
              </p>
              <p className="text-brand-secondary font-bold">
                {goalPercentage}%{" "}
                {member.todayIntakeMl >= member.todayGoalMl
                  ? "· Goal met"
                  : "complete"}
              </p>
            </div>
          </>
        )}
      </section>

      <section className="border-brand-secondary/5 mt-6 rounded-[1.75rem] border bg-white/85 p-5 sm:p-6">
        <p className="text-brand-primary text-xs font-bold tracking-[0.12em] uppercase">
          Last seven days
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-brand-background rounded-2xl p-4">
            <dt className="text-brand-secondary/40 text-xs font-bold uppercase">
              Daily average
            </dt>
            <dd className="text-brand-secondary mt-2 text-sm font-bold">
              {formatCommunityVolume(member.sevenDayAverageMl, unit)}
            </dd>
          </div>
          <div className="bg-brand-background rounded-2xl p-4">
            <dt className="text-brand-secondary/40 text-xs font-bold uppercase">
              Current streak
            </dt>
            <dd className="text-brand-secondary mt-2 text-sm font-bold">
              {member.currentStreak} days
            </dd>
          </div>
          <div className="bg-brand-background rounded-2xl p-4">
            <dt className="text-brand-secondary/40 text-xs font-bold uppercase">
              Goal completion
            </dt>
            <dd className="text-brand-secondary mt-2 text-sm font-bold">
              {member.sevenDayEligibleDays === 0
                ? "No eligible goal days"
                : `${member.sevenDayGoalDays} of ${member.sevenDayEligibleDays} days · ${completionPercentage}%`}
            </dd>
          </div>
          <div className="bg-brand-background rounded-2xl p-4">
            <dt className="text-brand-secondary/40 text-xs font-bold uppercase">
              Completed bottles
            </dt>
            <dd className="text-brand-secondary mt-2 text-sm font-bold">
              {member.completedBottlesThisWeek ?? 0}
            </dd>
          </div>
        </dl>

        {!hasHydration ? (
          <p className="text-brand-secondary/50 mt-5 text-sm leading-6">
            More trend information will appear as this member records hydration.
          </p>
        ) : null}

        {chartDays.length > 0 ? (
          <>
            <DailyIntakeChart
              currentDate={currentDate}
              days={chartDays}
              unit={unit}
            />
            <p className="text-brand-secondary/40 mt-3 text-xs">
              Based on {chartDays.length} local calendar day
              {chartDays.length === 1 ? "" : "s"}.
            </p>
          </>
        ) : null}
      </section>
    </>
  );
}
