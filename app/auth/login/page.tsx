import type { Metadata } from "next";

import { Brand } from "@/components/brand";
import { DropIcon, SparkleIcon } from "@/components/icons";
import { sanitizeLoginDestination } from "@/lib/application/auth/login-destination";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
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
    <main className="login-main relative flex min-h-dvh w-full max-w-full items-center justify-center overflow-x-clip overflow-y-auto pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:p-8">
      <div
        className="bg-brand-primary/10 pointer-events-none absolute top-[-8rem] right-[-6rem] size-80 rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div
        className="bg-brand-primary/10 pointer-events-none absolute bottom-[-10rem] left-[-8rem] size-96 rounded-full blur-3xl"
        aria-hidden="true"
      />

      <div
        data-testid="login-card"
        className="relative grid w-full max-w-5xl min-w-0 overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-[0_30px_100px_rgba(62,41,255,0.14)] backdrop-blur md:grid-cols-[0.9fr_1.1fr]"
      >
        <section className="bg-brand-primary relative hidden overflow-hidden p-10 text-white md:flex md:flex-col md:justify-between">
          <div className="absolute -right-20 -bottom-24 size-72 rounded-full border-[48px] border-white/10" />
          <div className="absolute top-28 -left-12 size-36 rounded-full border-[24px] border-white/10" />
          <span className="relative flex size-12 items-center justify-center rounded-2xl bg-white/15">
            <DropIcon className="size-6" />
          </span>
          <div className="relative">
            <SparkleIcon className="size-8 text-white/80" />
            <p className="mt-5 max-w-xs text-3xl font-bold tracking-[-0.04em]">
              A lighter way to stay in flow.
            </p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              HydroPOP keeps hydration simple, personal, and grounded in your
              day.
            </p>
          </div>
        </section>

        <section className="login-panel min-w-0 px-5 py-6 sm:px-12 sm:py-12">
          <Brand />
          <div className="login-copy mt-8 sm:mt-12">
            <p className="text-brand-primary text-xs font-bold tracking-[0.18em] uppercase">
              Welcome back
            </p>
            <h1 className="text-brand-secondary mt-3 text-3xl font-bold tracking-[-0.035em]">
              Sign in to HydroPOP
            </h1>
            <p className="text-brand-secondary/50 mt-3 text-sm leading-6">
              Access is limited to approved accounts. There is no public
              sign-up.
            </p>
          </div>
          <LoginForm destination={destination} />
        </section>
      </div>
    </main>
  );
}
