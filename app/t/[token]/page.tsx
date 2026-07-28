import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { DropIcon } from "@/components/icons";
import { isValidPublicNfcToken } from "@/lib/contracts/nfc-token";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";

export const metadata: Metadata = {
  title: "NFC link",
};

export default async function NfcTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isValidPublicNfcToken(token)) {
    notFound();
  }

  const destination = `/t/${encodeURIComponent(token)}` as Route;
  const user = await requireAllowedUser(destination);
  const supabase = await createClient();
  const onboarding = await getOnboardingSnapshot(supabase, user.id);

  if (!onboarding.isComplete) {
    redirect(
      onboarding.status.hasStartedConfiguration ? "/settings" : "/setup",
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/90 p-7 text-center shadow-[0_30px_100px_rgba(62,41,255,0.14)] backdrop-blur sm:p-10">
        <div className="bg-brand-primary mx-auto flex size-16 items-center justify-center rounded-3xl text-white shadow-lg shadow-[rgba(62,41,255,0.22)]">
          <DropIcon className="size-8" />
        </div>
        <div className="mt-7 flex justify-center">
          <Brand />
        </div>
        <p className="text-brand-primary mt-9 text-xs font-bold tracking-[0.18em] uppercase">
          NFC destination restored
        </p>
        <h1 className="text-brand-secondary mt-3 text-3xl font-bold tracking-[-0.035em]">
          Your scan made it through
        </h1>
        <p className="text-brand-secondary/55 mx-auto mt-4 max-w-sm text-sm leading-6">
          HydroPOP preserved this private NFC link while you signed in and
          completed setup. Bottle-event handling will be connected in the next
          hydration feature.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/today"
            className="bg-brand-primary hover:bg-brand-primary/90 flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white transition"
          >
            Go to Today
          </Link>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="border-brand-secondary/10 text-brand-secondary hover:border-brand-primary/30 h-12 w-full rounded-2xl border bg-white px-5 text-sm font-bold transition"
            >
              Log out
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
