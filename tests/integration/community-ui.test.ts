import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Community UI and access contracts", () => {
  it("switches from explicit membership setup to the real directory", () => {
    const page = source("app/(private)/community/page.tsx");
    const joinForm = source("app/(private)/community/community-join-form.tsx");
    const directory = source("app/(private)/community/community-directory.tsx");

    expect(page).toContain("Join the HydroPOP community");
    expect(page).toContain("<CommunityDirectory");
    expect(joinForm).toContain('name="consent"');
    expect(joinForm).toContain("Joining…");
    expect(joinForm).toContain("Joined ✓");
    expect(directory).toContain("setTimeout");
    expect(directory).toContain("filterCommunityMembers");
    expect(directory).toContain("No members matched your search.");
  });

  it("renders only limited member-profile fields with sparse states", () => {
    const page = source("app/(private)/u/[username]/page.tsx");

    expect(page).toContain("Community member unavailable");
    expect(page).toContain("No hydration recorded today.");
    expect(page).toContain("More trend information will appear");
    expect(page).toContain("<DailyIntakeChart");
    expect(page).toContain('role="progressbar"');
    expect(page).not.toContain("member.email");
    expect(page).not.toContain("member.timezone");
    expect(page).not.toContain("member.bottle");
    expect(page).not.toContain("member.userId");
  });

  it("supports username, URL, visibility, preview, copy, and hiding", () => {
    const page = source("app/(private)/settings/community/page.tsx");
    const form = source(
      "app/(private)/settings/community/community-settings-form.tsx",
    );

    expect(page).toContain("Community profile");
    expect(form).toContain("Copy profile URL");
    expect(form).toContain("Visible in Community");
    expect(form).toContain("Preview profile");
    expect(form).toContain("Leave / hide from Community");
    expect(form).toContain('value="hide"');
  });

  it("integrates Community without replacing the private profile", () => {
    const profile = source("app/(private)/profile/page.tsx");

    expect(profile).toContain("Private profile");
    expect(profile).toContain("Lifetime hydration");
    expect(profile).toContain("View my community profile");
    expect(profile).toContain("Community settings");
    expect(profile).toContain("Join Community");
  });

  it("protects, refreshes, and marks every Community surface noindex", () => {
    const proxy = source("proxy.ts");
    const loginDestination = source(
      "lib/application/auth/login-destination.ts",
    );
    const revalidation = source(
      "lib/application/hydration/revalidate-hydration-views.ts",
    );

    expect(proxy).toContain('"/community/:path*"');
    expect(proxy).toContain('"/u/:path*"');
    expect(loginDestination).toContain("communityMemberRoutePattern");
    expect(revalidation).toContain('"/community"');
    expect(revalidation).toContain('revalidatePath("/u/[username]", "page")');

    for (const path of [
      "app/(private)/community/page.tsx",
      "app/(private)/settings/community/page.tsx",
      "app/(private)/u/[username]/page.tsx",
    ]) {
      const page = source(path);
      expect(page).toContain("follow: false");
      expect(page).toContain("index: false");
    }
  });

  it("keeps the five primary navigation tabs", () => {
    const navigation = source("components/app-navigation.tsx");

    for (const label of [
      "Today",
      "Calendar",
      "Trends",
      "Community",
      "Profile",
    ]) {
      expect(navigation).toContain(`label: "${label}"`);
    }
    expect(navigation).toContain("grid-cols-5");
    expect(navigation).toContain(
      'href === "/community" && pathname.startsWith("/u/")',
    );
  });

  it("uses the standard server client and generated Community RPC types", () => {
    const adapter = source("lib/infrastructure/supabase/community.ts");
    const generated = source("lib/infrastructure/supabase/database.types.ts");

    expect(adapter).toContain('import { createClient } from "./server"');
    expect(adapter).not.toContain("createCommunityRpcClient");
    expect(adapter).not.toContain("CommunityPendingDatabase");
    expect(generated).toContain("check_community_username_availability:");
    expect(generated).toContain("get_community_member_summary:");
    expect(generated).toContain("get_my_community_profile:");
    expect(generated).toContain("list_community_member_summaries:");
    expect(generated).toContain("save_community_profile:");
  });

  it("does not introduce a service-role key", () => {
    const files = [
      "app/(private)/community/actions.ts",
      "lib/infrastructure/supabase/community.ts",
    ];

    for (const path of files) {
      expect(source(path).toLowerCase()).not.toContain("service_role");
      expect(source(path).toLowerCase()).not.toContain("service-role");
    }
  });
});
