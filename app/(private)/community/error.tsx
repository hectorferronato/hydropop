"use client";

export default function CommunityError({ reset }: { reset: () => void }) {
  return (
    <section
      role="alert"
      className="border-brand-secondary/5 rounded-[2rem] border bg-white/90 p-6 text-center"
    >
      <h1 className="text-brand-secondary text-xl font-bold">
        Community couldn’t load
      </h1>
      <p className="text-brand-secondary/55 mt-2 text-sm">
        Your private data remains unchanged. Try loading the member directory
        again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-brand-primary mt-5 h-11 rounded-2xl px-5 text-sm font-bold text-white"
      >
        Try again
      </button>
    </section>
  );
}
