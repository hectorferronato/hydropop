import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import {
  buildCommunityProfileUrl,
  getCanonicalSiteUrl,
} from "@/lib/application/urls/site-url";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getMyCommunityProfile } from "@/lib/infrastructure/supabase/community";

import { CommunitySettingsForm } from "./community-settings-form";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Community settings · HydroPOP",
};

export default async function CommunitySettingsPage() {
  await connection();
  await requireAllowedUser("/settings/community");

  const profile = await getMyCommunityProfile();

  if (!profile) {
    return (
      <section className="border-brand-secondary/5 mx-auto max-w-2xl rounded-[2rem] border bg-white/90 p-6">
        <h1 className="text-brand-secondary text-2xl font-bold">
          Join Community first
        </h1>
        <p className="text-brand-secondary/55 mt-3 text-sm leading-6">
          Community settings appear after you explicitly create a limited member
          profile.
        </p>
        <Link
          href="/community"
          className="bg-brand-primary mt-5 inline-flex h-11 items-center rounded-2xl px-4 text-sm font-bold text-white"
        >
          Join Community
        </Link>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Community profile"
        description="Control the limited identity and hydration summary shared with signed-in HydroPOP members."
      />
      {!profile.isVisible ? (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
        >
          Your profile is hidden from the directory and unavailable to other
          members. Your username remains reserved.
        </div>
      ) : null}
      <CommunitySettingsForm
        initialIsVisible={profile.isVisible}
        initialUsername={profile.username}
        profileUrl={buildCommunityProfileUrl(
          getCanonicalSiteUrl(),
          profile.username,
        )}
      />
    </>
  );
}
