"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  filterCommunityMembers,
  formatCommunityVolume,
  getCommunityGoalPercentage,
  getCommunityInitials,
} from "@/lib/application/community/presentation";
import type { CommunityMemberSummary } from "@/lib/contracts/community";
import type { VolumeUnit } from "@/lib/units/volume";

function MemberCard({
  member,
  unit,
}: {
  member: CommunityMemberSummary;
  unit: VolumeUnit;
}) {
  const goalPercentage = getCommunityGoalPercentage(
    member.todayIntakeMl,
    member.todayGoalMl,
  );

  return (
    <article className="border-brand-secondary/5 flex min-w-0 flex-col rounded-[1.75rem] border bg-white/90 p-5 shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-brand-primary/10 text-brand-primary flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold">
          {getCommunityInitials(member.displayName)}
        </div>
        <div className="min-w-0">
          <h2 className="text-brand-secondary truncate text-base font-bold">
            {member.displayName}
          </h2>
          <p className="text-brand-primary truncate text-xs font-semibold">
            @{member.username}
          </p>
        </div>
      </div>

      <div className="mt-5 flex-1">
        {member.todayIntakeMl === 0 ? (
          <p className="text-brand-secondary/55 text-sm font-semibold">
            No hydration recorded yet today
          </p>
        ) : (
          <p className="text-brand-secondary text-sm font-bold">
            {formatCommunityVolume(member.todayIntakeMl, unit)}
            {member.todayGoalMl === null
              ? " today"
              : ` of ${formatCommunityVolume(member.todayGoalMl, unit)} today`}
          </p>
        )}
        <dl className="mt-4 grid gap-2 text-xs">
          {goalPercentage === null ? null : (
            <div className="flex justify-between gap-3">
              <dt className="text-brand-secondary/45">Daily goal</dt>
              <dd className="text-brand-secondary font-semibold">
                {goalPercentage}% complete
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-brand-secondary/45">Current streak</dt>
            <dd className="text-brand-secondary font-semibold">
              {member.currentStreak}-day streak
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-brand-secondary/45">7-day average</dt>
            <dd className="text-brand-secondary font-semibold">
              {formatCommunityVolume(member.sevenDayAverageMl, unit)}
            </dd>
          </div>
        </dl>
      </div>

      <Link
        href={`/u/${member.username}` as Route}
        className="text-brand-primary focus-visible:outline-brand-primary mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-current/15 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        View member profile
      </Link>
    </article>
  );
}

export function CommunityDirectory({
  members,
  unit,
}: {
  members: CommunityMemberSummary[];
  unit: VolumeUnit;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filteredMembers = useMemo(
    () => filterCommunityMembers(members, search),
    [members, search],
  );

  return (
    <>
      <label
        htmlFor="community-search"
        className="text-brand-secondary mt-7 block text-sm font-bold"
      >
        Find a member
      </label>
      <input
        id="community-search"
        type="search"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder="Search by name or username"
        className="border-brand-secondary/10 focus:border-brand-primary focus:ring-brand-primary/15 text-brand-secondary mt-2 h-12 w-full rounded-2xl border bg-white px-4 text-sm transition outline-none focus:ring-4"
      />

      {members.length === 0 ? (
        <div className="border-brand-secondary/5 mt-6 rounded-[1.75rem] border bg-white/80 p-6 text-center">
          <p className="text-brand-secondary font-bold">
            No community members yet.
          </p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="border-brand-secondary/5 mt-6 rounded-[1.75rem] border bg-white/80 p-6 text-center">
          <p className="text-brand-secondary font-bold">
            No members matched your search.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((member) => (
            <MemberCard key={member.username} member={member} unit={unit} />
          ))}
        </div>
      )}
    </>
  );
}
