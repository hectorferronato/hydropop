import type { Metadata } from "next";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { DropIcon } from "@/components/icons";
import {
  createLoginPath,
  sanitizeLoginDestination,
} from "@/lib/application/auth/login-destination";

export const metadata: Metadata = {
  title: "Account not authorized",
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const parameters = await searchParams;
  const requestedDestination = Array.isArray(parameters.next)
    ? parameters.next[0]
    : parameters.next;
  const destination = sanitizeLoginDestination(requestedDestination);

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/90 p-7 text-center shadow-[0_30px_100px_rgba(62,41,255,0.14)] backdrop-blur sm:p-10">
        <div className="bg-brand-primary/10 text-brand-primary mx-auto flex size-14 items-center justify-center rounded-2xl">
          <DropIcon className="size-7" />
        </div>
        <div className="mt-7 flex justify-center">
          <Brand />
        </div>
        <p className="text-brand-primary mt-9 text-xs font-bold tracking-[0.18em] uppercase">
          Private beta
        </p>
        <h1 className="text-brand-secondary mt-3 text-3xl font-bold tracking-[-0.035em]">
          This account isn’t approved yet
        </h1>
        <p className="text-brand-secondary/55 mx-auto mt-4 max-w-sm text-sm leading-6">
          HydroPOP is currently limited to invited accounts. Ask the account
          administrator to add your email, then try again.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href={createLoginPath(destination)}
            className="border-brand-secondary/10 text-brand-secondary hover:border-brand-primary/30 flex h-12 items-center justify-center rounded-2xl border bg-white px-5 text-sm font-bold transition"
          >
            Try another email
          </Link>
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="bg-brand-primary hover:bg-brand-primary/90 focus-visible:outline-brand-primary h-12 w-full rounded-2xl px-5 text-sm font-bold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Clear session
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
