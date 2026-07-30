import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260730120000_add_private_community_pilot.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const existingRls = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260725120100_add_hydropop_rls.sql",
  ),
  "utf8",
);

function functionDefinition(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}`);

  if (start < 0) {
    throw new Error(`Missing function ${name}`);
  }

  const end = migration.indexOf("\n$$;", start);

  if (end < 0) {
    throw new Error(`Unterminated function ${name}`);
  }

  return migration.slice(start, end + 4);
}

describe("Community migration", () => {
  it("creates normalized member identities and permanent reservations", () => {
    expect(migration).toContain("create table public.community_profiles");
    expect(migration).toContain(
      "create table public.community_username_reservations",
    );
    expect(migration).toContain("username ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'");
    expect(migration).toContain(
      "constraint community_profiles_username_key unique (username)",
    );
    expect(migration).toContain("on delete set null");
    expect(migration).toContain("community_profiles_reserve_username");
    expect(migration).toContain("USERNAME_UNAVAILABLE");
    expect(migration).not.toMatch(/\bdelete from public\.community_/u);
  });

  it("keeps reservations unreadable and profiles member-scoped", () => {
    expect(migration).toContain(
      "alter table public.community_profiles enable row level security",
    );
    expect(migration).toContain(
      "alter table public.community_username_reservations enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.community_username_reservations from public, anon, authenticated",
    );
    expect(migration).toContain(
      "revoke all on table public.community_profiles from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select (username, display_name, is_visible, joined_at)",
    );
    expect(migration).toContain(
      "grant insert (user_id, username, display_name, is_visible)",
    );
    expect(migration).toContain(
      "grant update (username, display_name, is_visible)",
    );
    expect(migration).not.toContain(
      "grant delete on table public.community_profiles",
    );
    expect(migration).toContain(
      "(select auth.uid()) = user_id\n  or is_visible",
    );
    expect(migration).toContain(
      'create policy "users can update their own community profile"',
    );
  });

  it("reserves username changes in the same transaction", () => {
    const reservationTrigger = functionDefinition("reserve_community_username");

    expect(reservationTrigger).toContain("security definer");
    expect(reservationTrigger).toContain("set search_path = ''");
    expect(reservationTrigger).toContain("auth.uid()");
    expect(reservationTrigger).toContain(
      "insert into public.community_username_reservations",
    );
    expect(reservationTrigger).toContain("new.user_id <> v_requester");
  });

  it("uses invoker rights for own-profile mutation", () => {
    const save = functionDefinition("save_community_profile");

    expect(save).toContain("security invoker");
    expect(save).toContain("set search_path = ''");
    expect(save).toContain("v_user_id uuid := auth.uid()");
    expect(save).not.toMatch(/p_(?:user|member)_id/u);
    expect(save).toContain("from public.profiles");
    expect(save).toContain("public.get_my_community_profile()");
    expect(save).toContain("if v_current_username is null then");
    expect(save).toContain("update public.community_profiles");
  });

  it("returns the current profile without granting clients its internal ID", () => {
    const getMyProfile = functionDefinition("get_my_community_profile");

    expect(getMyProfile).toContain("security definer");
    expect(getMyProfile).toContain("set search_path = ''");
    expect(getMyProfile).toContain("auth.uid()");
    expect(getMyProfile).not.toContain("'user_id'");
    expect(migration).not.toContain(
      "grant select on table public.community_profiles",
    );
  });

  it("limits availability checks to one candidate", () => {
    const availability = functionDefinition(
      "check_community_username_availability",
    );

    expect(availability).toContain("stable");
    expect(availability).toContain("security definer");
    expect(availability).toContain("auth.uid()");
    expect(availability).toContain(
      "community_username_reservations.username = v_username",
    );
    expect(availability).not.toContain("jsonb_agg");
  });

  it("protects cross-user aggregate readers with narrow grants", () => {
    for (const functionName of [
      "list_community_member_summaries",
      "get_community_member_summary",
    ]) {
      const definition = functionDefinition(functionName);

      expect(definition).toContain("stable");
      expect(definition).toContain("security definer");
      expect(definition).toContain("set search_path = ''");
      expect(definition).toContain("auth.uid()");
      expect(definition).not.toContain("execute ");
      expect(definition).not.toMatch(/p_(?:requesting_)?user_id/u);
    }

    expect(migration).toContain(
      "revoke execute on function public.list_community_member_summaries(text, integer)\nfrom public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.list_community_member_summaries(text, integer)\nto authenticated",
    );
    expect(migration).toContain(
      "revoke execute on function public.get_community_member_summary(text) from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.get_community_member_summary(text) to authenticated",
    );
  });

  it("returns visible members only with bounded directory and dates", () => {
    const list = functionDefinition("list_community_member_summaries");

    expect(list).toContain("where community_profiles.is_visible");
    expect(list).toContain("least(coalesce(p_limit, 50), 50)");
    expect(list).toContain("limit v_limit");
    expect(list).toContain("pg_catalog.lower(community_profiles.display_name)");
    expect(migration).toContain("greatest(v_today - 6, v_first_relevant_date)");
    expect(migration).toContain(
      "hydration_goals.effective_from <= days.hydration_day",
    );
  });

  it("uses owner-local dates and effective immutable event projections", () => {
    const daily = functionDefinition("community_member_daily_aggregate");

    expect(daily).toContain(
      "hydration_events.occurred_at at time zone member.timezone",
    );
    expect(daily).toContain("hydration_events.event_type <> 'event_reversed'");
    expect(daily).toContain(
      "reversals.reverses_event_id = hydration_events.id",
    );
    expect(daily).toContain("else hydration_events.volume_ml");
    expect(daily).toContain("hydration_events.event_type = 'bottle_completed'");
    expect(daily).not.toContain("bottles.capacity_ml");
    expect(daily).not.toContain("hydration_events.metadata");
  });

  it("returns only approved aggregate keys", () => {
    const build = functionDefinition("build_community_member_summary");
    const returnedKeys = [
      "username",
      "display_name",
      "joined_at",
      "today_intake_ml",
      "today_goal_ml",
      "current_streak",
      "seven_day_average_ml",
      "seven_day_goal_days",
      "seven_day_eligible_days",
      "completed_bottles_this_week",
      "daily",
    ];

    for (const key of returnedKeys) {
      expect(build).toContain(`'${key}'`);
    }

    for (const privateKey of [
      "'email'",
      "'phone'",
      "'timezone'",
      "'bottle_id'",
      "'nfc_tag'",
      "'user_id'",
      "'event_id'",
      "'occurred_at'",
    ]) {
      expect(build).not.toContain(privateKey);
    }
  });

  it("does not schema-qualify PostgreSQL conditional expressions", () => {
    expect(migration).not.toMatch(
      /pg_catalog\.(?:coalesce|nullif|greatest|least)\s*\(/iu,
    );
  });

  it("does not alter private-table RLS or introduce destructive SQL", () => {
    expect(migration).not.toMatch(
      /alter table public\.(?:profiles|hydration_events|hydration_goals|bottles|nfc_tags)\s+(?:disable row level security|no force row level security)/iu,
    );
    expect(migration).not.toMatch(
      /\b(?:drop table|truncate|delete from auth\.|alter table auth\.)\b/iu,
    );
    expect(existingRls).toContain("create policy hydration_events_select_own");
    expect(existingRls).toContain("user_id = (select auth.uid())");
  });
});
