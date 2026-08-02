"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionSpinner } from "@/components/action-feedback";
import type { ApiResponse } from "@/lib/contracts/api-response";

type PilotActivationResult = { activated: true };

export function PilotActivationCard() {
  const router = useRouter();
  const submissionLockRef = useRef(false);
  const [state, setState] = useState<"idle" | "pending" | "saved">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function activate() {
    if (submissionLockRef.current) {
      return;
    }

    submissionLockRef.current = true;
    setState("pending");
    setMessage(null);

    try {
      const response = await fetch("/api/v1/nfc-tags/pilot/activate", {
        method: "POST",
      });
      const payload =
        (await response.json()) as ApiResponse<PilotActivationResult>;

      if (payload.error) {
        setMessage(payload.error.message);
        setState("idle");
        return;
      }

      setState("saved");
      router.refresh();
    } catch {
      setMessage(
        "HydroPOP could not reach the server. No tag change was confirmed.",
      );
      setState("idle");
    } finally {
      submissionLockRef.current = false;
    }
  }

  return (
    <main className="flex min-h-dvh w-full max-w-full items-center justify-center overflow-x-clip px-5 py-10">
      <section className="w-full max-w-lg min-w-0 rounded-[2rem] border border-white/80 bg-white/95 p-7 text-center shadow-[0_30px_100px_rgba(62,41,255,0.14)] sm:p-10">
        <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
          One-time setup
        </p>
        <h1 className="text-brand-secondary mt-3 text-3xl font-bold tracking-[-0.035em]">
          Activate your HydroPOP pilot tag
        </h1>
        <p className="text-brand-secondary/55 mx-auto mt-4 max-w-sm text-sm leading-6">
          Connect this tag to your primary bottle so future scans are ready to
          record water.
        </p>
        <button
          type="button"
          disabled={state !== "idle"}
          onClick={() => void activate()}
          className="bg-brand-primary hover:bg-brand-primary/90 mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-5 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-65"
        >
          {state === "pending" ? (
            <span className="inline-flex items-center gap-2">
              <ActionSpinner />
              Activating…
            </span>
          ) : state === "saved" ? (
            "Activated ✓"
          ) : (
            "Activate pilot tag"
          )}
        </button>
        {message ? (
          <p role="alert" className="mt-4 text-sm font-semibold text-red-700">
            {message}
          </p>
        ) : null}
        <p className="text-brand-secondary/40 mt-5 text-xs leading-5">
          Viewing this page never changes your tag. Activation happens only
          after you press the button.
        </p>
      </section>
    </main>
  );
}
