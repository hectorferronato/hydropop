import { DropIcon } from "./icons";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-brand-primary flex size-10 items-center justify-center rounded-2xl text-white shadow-lg shadow-[rgba(62,41,255,0.16)]">
        <DropIcon className="size-5" />
      </span>
      <span
        className={compact ? "sr-only" : "text-xl font-bold tracking-tight"}
      >
        Hydro<span className="text-brand-primary">POP</span>
      </span>
    </div>
  );
}
