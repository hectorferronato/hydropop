"use client";

export default function SettingsError({ reset }: { reset: () => void }) {
  return (
    <section className="border-brand-secondary/5 rounded-[2rem] border bg-white/85 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.06)] sm:p-8">
      <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
        Settings unavailable
      </p>
      <h1 className="text-brand-secondary mt-2 text-2xl font-bold tracking-tight">
        We couldn’t load your settings
      </h1>
      <p className="text-brand-secondary/55 mt-3 text-sm leading-6">
        Your saved information has not been changed. Try loading it again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-brand-primary hover:bg-brand-primary/90 focus-visible:outline-brand-primary mt-6 h-12 rounded-2xl px-5 text-sm font-bold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Try again
      </button>
    </section>
  );
}
