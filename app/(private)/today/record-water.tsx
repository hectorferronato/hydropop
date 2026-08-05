"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionSpinner } from "@/components/action-feedback";
import { HydrationSuccessCelebration } from "@/components/hydration-success-celebration";
import {
  completeHydrationFeedback,
  prepareHydrationFeedback,
} from "@/lib/application/celebration/hydration-feedback";
import type { ApiResponse } from "@/lib/contracts/api-response";
import type { HydrationRecordingSemantic } from "@/lib/contracts/hydration-success";
import type { ManualHydrationResult } from "@/lib/contracts/manual-hydration";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

type PendingRequest = {
  action: HydrationRecordingSemantic;
  idempotencyKey: string;
  occurredAt: string;
};

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function RecordWater({
  bottleName,
  initiallyOpen = false,
  normalFillMl,
  unit,
}: {
  bottleName: string;
  initiallyOpen?: boolean;
  normalFillMl: number;
  unit: VolumeUnit;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const submissionLockRef = useRef(false);
  const retryRequestRef = useRef<PendingRequest | null>(null);
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [pendingAction, setPendingAction] =
    useState<HydrationRecordingSemantic | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ManualHydrationResult | null>(null);
  const halfFillMl = Math.max(1, Math.round(normalFillMl / 2));

  useEffect(() => {
    if (initiallyOpen) {
      router.replace("/today", { scroll: false });
    }
  }, [initiallyOpen, router]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const firstFocusable =
      dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();
  }, [isOpen, result]);

  function close() {
    if (pendingAction) {
      return;
    }

    setIsOpen(false);
    setResult(null);
    setMessage(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function record(action: HydrationRecordingSemantic) {
    if (submissionLockRef.current) {
      return;
    }

    const preparedFeedback = prepareHydrationFeedback();
    const request =
      retryRequestRef.current?.action === action
        ? retryRequestRef.current
        : {
            action,
            idempotencyKey: crypto.randomUUID(),
            occurredAt: new Date().toISOString(),
          };

    submissionLockRef.current = true;
    retryRequestRef.current = request;
    setPendingAction(action);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/hydration-events/manual", {
        body: JSON.stringify(request),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload =
        (await response.json()) as ApiResponse<ManualHydrationResult>;

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      retryRequestRef.current = null;
      setResult(payload.data);
      completeHydrationFeedback(preparedFeedback, payload.data);
      window.dispatchEvent(new Event("hydropop:hydration-mutated"));
      router.refresh();
    } catch {
      setMessage(
        "HydroPOP could not reach the server. Try again safely; the same request key will be reused.",
      );
    } finally {
      submissionLockRef.current = false;
      setPendingAction(null);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-brand-primary hover:bg-brand-primary/90 mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl px-6 text-base font-bold text-white shadow-lg shadow-[rgba(62,41,255,0.2)] active:scale-[0.98] sm:w-auto sm:min-w-52"
      >
        Record water
      </button>

      {isOpen ? (
        <div
          className="bg-brand-secondary/45 fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          aria-hidden="false"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-water-title"
            aria-describedby="record-water-description"
            onKeyDown={handleDialogKeyDown}
            className="max-h-[min(90dvh,44rem)] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-white/70 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_30px_100px_rgba(15,23,42,0.25)] sm:rounded-[2rem] sm:p-7"
          >
            {result ? (
              <>
                <h2 id="record-water-title" className="sr-only">
                  Water recorded
                </h2>
                <p id="record-water-description" className="sr-only">
                  Confirmed hydration result
                </p>
                <HydrationSuccessCelebration result={result} unit={unit} />
                <button
                  type="button"
                  onClick={close}
                  className="bg-brand-primary mt-5 min-h-12 w-full rounded-2xl px-5 text-sm font-bold text-white"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
                  {bottleName}
                </p>
                <h2
                  id="record-water-title"
                  className="text-brand-secondary mt-2 text-2xl font-bold tracking-tight"
                >
                  Record water
                </h2>
                <p
                  id="record-water-description"
                  className="text-brand-secondary/50 mt-2 text-sm leading-6"
                >
                  Choose the amount you just finished. HydroPOP resolves your
                  active bottle and records the volume on the server.
                </p>
                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => void record("full")}
                    className="bg-brand-primary hover:bg-brand-primary/90 min-h-16 w-full rounded-2xl px-5 py-4 text-base font-bold text-white active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                  >
                    {pendingAction === "full" ? (
                      <span className="inline-flex items-center gap-2">
                        <ActionSpinner /> Recording…
                      </span>
                    ) : (
                      `Record one bottle — ${formatDisplayVolume(normalFillMl, unit)} ${unit}`
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => void record("half")}
                    className="border-brand-primary/20 text-brand-primary min-h-14 w-full rounded-2xl border bg-white px-5 py-3 text-sm font-bold active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                  >
                    {pendingAction === "half" ? (
                      <span className="inline-flex items-center gap-2">
                        <ActionSpinner /> Recording…
                      </span>
                    ) : (
                      `Record half — ${formatDisplayVolume(halfFillMl, unit)} ${unit}`
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={close}
                    className="text-brand-secondary/55 min-h-12 w-full rounded-2xl px-5 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
                {message ? (
                  <p
                    role="alert"
                    className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700"
                  >
                    {message}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
