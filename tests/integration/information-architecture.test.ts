import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("calendar information architecture", () => {
  const page = source("app/(private)/calendar/page.tsx");
  const grid = source("app/(private)/calendar/calendar-grid.tsx");

  it("derives the current local month and default day from the profile timezone", () => {
    expect(page).toContain("getDateInTimezone(");
    expect(page).toContain("snapshot.profile?.timezone");
    expect(page).toContain("const currentMonth = currentDate.slice(0, 7)");
    expect(page).toContain("month === currentMonth");
    expect(page).toContain("day.date === currentDate");
  });

  it("marks and distinguishes today, selected, and combined states", () => {
    expect(grid).toContain('aria-current={isToday ? "date" : undefined}');
    expect(grid).toContain('data-selected={isSelected ? "true" : undefined}');
    expect(grid).toContain('data-today={isToday ? "true" : undefined}');
    expect(grid).toContain("isToday && isSelected");
    expect(grid).toContain('"Today"');
    expect(grid).toContain("today and selected");
  });

  it("scrolls only the calendar viewport to the current chronological week", () => {
    expect(grid).toContain("getCurrentWeekIndex(month, currentDate)");
    expect(grid).toContain("viewport.scrollTo({");
    expect(grid).toContain("requestAnimationFrame");
    expect(grid).toContain("data-current-week=");
    expect(grid).toContain("overflow-y-auto");
    expect(grid).not.toContain("scrollIntoView");
  });

  it("restores today and leaves historical months at their normal top", () => {
    expect(grid).toContain(
      "href={`/calendar?month=${currentMonth}&day=${currentDate}`}",
    );
    expect(grid).toContain("onClick={scrollCurrentWeekToTop}");
    expect(grid).toContain("currentWeekIndex === null");
    expect(grid).toContain("scrollTo({ top: 0 })");
  });
});

describe("trends, private profile, and community presentation", () => {
  const trends = source("app/(private)/trends/page.tsx");
  const charts = source("app/(private)/trends/trend-charts.tsx");
  const profile = source("app/(private)/profile/page.tsx");
  const community = source("app/(private)/community/page.tsx");

  it("validates range input server-side and presents converted real data", () => {
    expect(trends).toContain("parseTrendRange(");
    expect(trends).toContain("buildTrendsSummary(");
    expect(trends).toContain("getHydrationSnapshot(");
    expect(trends).toContain("formatDisplayVolume(");
    expect(trends).toContain("Record your first bottle to start seeing trends");
    expect(trends).toContain("No hydration recorded in this range");
    expect(charts).toContain('role="img"');
    expect(charts).toContain('className="sr-only"');
  });

  it("keeps profile data private and preserves management routes", () => {
    expect(profile).toContain("Private profile");
    expect(profile).toContain("visible only to you during the pilot");
    expect(profile).toContain('href: "/settings/hydration"');
    expect(profile).toContain('href: "/settings/bottle"');
    expect(profile).toContain('href: "/device/nfc"');
    expect(profile).toContain('href: "/settings/profile"');
    expect(profile).toContain('href: "/settings"');
    expect(profile).toContain('action="/auth/logout"');
  });

  it("renders only a static, honest community placeholder", () => {
    expect(community).toContain("Hydrate together");
    expect(community).toContain("Coming soon");
    expect(community).toContain("does not create public profiles");
    expect(community).not.toMatch(/\.(?:insert|update|delete|rpc)\s*\(/u);
    expect(community).not.toContain("<form");
    expect(community).not.toContain("fake");
  });
});

describe("responsive navigation and freshness", () => {
  const navigation = source("components/app-navigation.tsx");
  const shell = source("components/app-shell.tsx");
  const revalidation = source(
    "lib/application/hydration/revalidate-hydration-views.ts",
  );

  it("uses exactly five primary tabs without horizontal scrolling", () => {
    for (const path of [
      "/today",
      "/calendar",
      "/trends",
      "/community",
      "/profile",
    ]) {
      expect(navigation).toContain(`href: "${path}"`);
    }

    expect(navigation).toContain("grid-cols-5");
    expect(navigation).toContain("min-h-14");
    expect(navigation).toContain("min-w-0");
    expect(navigation).toContain("env(safe-area-inset-bottom)");
    expect(navigation).not.toContain("overflow-x-auto");
    expect(navigation).toContain('aria-current={active ? "page" : undefined}');
    expect(navigation).toContain("<ActionSpinner");
  });

  it("keeps Device and Settings reachable as desktop secondary actions", () => {
    expect(navigation).toContain('href: "/device"');
    expect(navigation).toContain('href: "/settings"');
    expect(shell).toContain("<DesktopSecondaryNavigation");
  });

  it("provides route skeletons for every new destination", () => {
    for (const path of [
      "app/(private)/trends/loading.tsx",
      "app/(private)/community/loading.tsx",
      "app/(private)/profile/loading.tsx",
    ]) {
      expect(source(path)).toContain("<PageLoadingSkeleton");
    }
  });

  it("protects new routes through the session-refresh proxy", () => {
    const proxy = source("proxy.ts");
    const destinations = source("lib/application/auth/login-destination.ts");

    for (const path of ["trends", "community", "profile"]) {
      expect(proxy).toContain(`"/${path}/:path*"`);
      expect(destinations).toContain(path);
    }
  });

  it("invalidates all hydration-derived views from every mutation flow", () => {
    for (const path of ["/today", "/calendar", "/trends", "/profile"]) {
      expect(revalidation).toContain(`"${path}"`);
    }

    for (const path of [
      "app/api/v1/hydration-events/route.ts",
      "app/api/v1/nfc-tags/complete/route.ts",
      "app/(private)/settings/actions.ts",
      "app/(private)/setup/actions.ts",
    ]) {
      expect(source(path)).toContain("revalidateHydrationViews()");
    }
  });
});
