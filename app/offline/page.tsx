import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-5 py-10">
      <section className="w-full rounded-[2rem] border border-slate-900/5 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
          HydroPOP
        </p>
        <h1 className="text-brand-secondary mt-3 text-3xl font-bold tracking-tight">
          You’re offline
        </h1>
        <p className="text-brand-secondary/55 mt-3 text-sm leading-6">
          Reconnect to view your current hydration data or record water. No
          hydration was changed while this page was offline.
        </p>
        <Link
          href="/today"
          className="bg-brand-primary mt-6 inline-flex min-h-11 items-center rounded-2xl px-5 text-sm font-bold text-white"
        >
          Try again
        </Link>
      </section>
    </main>
  );
}
