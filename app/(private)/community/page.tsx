import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { CommunityIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { suggestCommunityUsername } from "@/lib/domain/community/username";
import { getCanonicalSiteUrl } from "@/lib/application/urls/site-url";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  getMyCommunityProfile,
  listCommunityMembers,
} from "@/lib/infrastructure/supabase/community";
import { getCommunityViewerProfile } from "@/lib/infrastructure/supabase/community-viewer";

import { CommunityDirectory } from "./community-directory";
import { CommunityJoinForm } from "./community-join-form";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Community · HydroPOP",
};

export default async function CommunityPage() {
  await connection();

  const user = await requireAllowedUser("/community");
  const [communityProfile, viewer] = await Promise.all([
    getMyCommunityProfile(),
    getCommunityViewerProfile(user.id),
  ]);

  if (!communityProfile) {
    return (
      <section className="border-brand-secondary/5 mx-auto max-w-2xl rounded-[2rem] border bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="bg-brand-primary/8 text-brand-primary flex size-14 items-center justify-center rounded-2xl">
          <CommunityIcon className="size-7" />
        </div>
        <h1 className="text-brand-secondary mt-5 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
          Join the HydroPOP community
        </h1>
        <p className="text-brand-secondary/55 mt-3 text-sm leading-6">
          Share a limited hydration summary with other signed-in friends and
          family using HydroPOP.
        </p>
        <CommunityJoinForm
          profileOrigin={getCanonicalSiteUrl()}
          suggestedUsername={suggestCommunityUsername(viewer.displayName)}
        />
      </section>
    );
  }

  const members = await listCommunityMembers();

  return (
    <>
      <PageHeader
        eyebrow="Friends & family pilot"
        title="HydroPOP Community"
        description="A private directory of members who chose to share a limited hydration summary."
      />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <p className="text-brand-secondary/55 text-sm">
          Signed in as{" "}
          <span className="text-brand-secondary font-bold">
            @{communityProfile.username}
          </span>
        </p>
        <Link
          href={"/settings/community" as Route}
          className="text-brand-primary rounded-xl text-sm font-bold"
        >
          Community settings
        </Link>
      </div>
      <CommunityDirectory members={members} unit={viewer.preferredUnit} />
    </>
  );
}
