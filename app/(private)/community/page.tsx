import Link from "next/link";

import { CommunityIcon, SparkleIcon } from "@/components/icons";

const plannedCapabilities = [
  "Add trusted friends",
  "Share selected progress",
  "Encourage consistency",
] as const;

export default function CommunityPage() {
  return (
    <section className="border-brand-secondary/5 mx-auto max-w-3xl rounded-[2rem] border bg-white/90 p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-10">
      <div className="bg-brand-primary/8 text-brand-primary relative mx-auto flex size-20 items-center justify-center rounded-[2rem]">
        <CommunityIcon className="size-9" />
        <SparkleIcon className="absolute -top-2 -right-2 size-7" />
      </div>
      <span className="bg-brand-primary/8 text-brand-primary mt-6 inline-flex rounded-full px-3 py-1.5 text-xs font-bold tracking-[0.12em] uppercase">
        Coming soon
      </span>
      <h1 className="text-brand-secondary mt-4 text-3xl font-bold tracking-[-0.04em]">
        Hydrate together
      </h1>
      <p className="text-brand-secondary/55 mx-auto mt-4 max-w-lg text-sm leading-6">
        Friends and shared progress are planned for a future HydroPOP phase.
        This pilot does not create public profiles, connections, or activity
        feeds.
      </p>
      <ul className="mx-auto mt-7 grid max-w-lg gap-3 text-left">
        {plannedCapabilities.map((capability) => (
          <li
            key={capability}
            className="bg-brand-background text-brand-secondary flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold"
          >
            <span
              aria-hidden="true"
              className="bg-brand-primary/10 text-brand-primary flex size-7 shrink-0 items-center justify-center rounded-full"
            >
              ✓
            </span>
            {capability}
            <span className="text-brand-secondary/35 ml-auto text-[0.62rem] font-bold uppercase">
              Planned
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Link
          href="/today"
          className="bg-brand-primary flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold text-white"
        >
          Back to Today
        </Link>
        <Link
          href="/profile"
          className="border-brand-primary/20 text-brand-primary flex h-12 items-center justify-center rounded-2xl border bg-white px-5 text-sm font-bold"
        >
          View private profile
        </Link>
      </div>
    </section>
  );
}
