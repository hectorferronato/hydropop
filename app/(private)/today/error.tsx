"use client";

export default function TodayError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      role="alert"
      className="rounded-[1.75rem] border border-red-200 bg-red-50 p-6"
    >
      <h1 className="text-xl font-bold text-red-800">
        Today’s dashboard couldn’t load
      </h1>
      <p className="mt-2 text-sm leading-6 text-red-800/65">
        Your hydration history was not replaced with defaults. Try loading the
        secure data again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white"
      >
        Try again
      </button>
    </section>
  );
}
