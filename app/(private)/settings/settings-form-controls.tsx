"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import type { SettingsActionState } from "./state";

export const settingsInputClassName =
  "mt-2 h-12 w-full rounded-2xl border border-brand-secondary/10 bg-white px-4 text-base text-brand-secondary outline-none transition placeholder:text-brand-secondary/25 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10";

export function SettingsFieldError({
  field,
  state,
}: {
  field: string;
  state: SettingsActionState;
}) {
  const error = state.fieldErrors?.[field]?.[0];

  return error ? (
    <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>
  ) : null;
}

export function SettingsFormMessage({ state }: { state: SettingsActionState }) {
  return state.message ? (
    <p
      role="alert"
      className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
    >
      {state.message}
    </p>
  ) : null;
}

export function SettingsFormActions() {
  const { pending } = useFormStatus();

  return (
    <div className="border-brand-secondary/5 mt-8 flex gap-3 border-t pt-5">
      <Link
        href="/settings"
        className="border-brand-secondary/10 text-brand-secondary hover:border-brand-primary/30 flex h-12 items-center rounded-2xl border bg-white px-5 text-sm font-bold transition"
      >
        Cancel
      </Link>
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary hover:bg-brand-primary/90 focus-visible:outline-brand-primary h-12 flex-1 rounded-2xl px-5 text-sm font-bold text-white shadow-lg shadow-[rgba(62,41,255,0.18)] transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
