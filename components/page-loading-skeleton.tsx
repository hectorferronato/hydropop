import { ActionSpinner } from "./action-feedback";

export function PageLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="animate-pulse">
      <div className="text-brand-primary flex items-center gap-3 text-sm font-semibold">
        <ActionSpinner />
        Loading…
      </div>
      <div className="mt-5 h-10 w-2/3 max-w-sm rounded-2xl bg-white/90" />
      <div className="mt-3 h-5 w-full max-w-xl rounded-xl bg-white/65" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="h-48 rounded-[2rem] bg-white/80" />
        <div className="h-48 rounded-[2rem] bg-white/80" />
      </div>
      <span className="sr-only">Loading the requested HydroPOP page.</span>
    </div>
  );
}
