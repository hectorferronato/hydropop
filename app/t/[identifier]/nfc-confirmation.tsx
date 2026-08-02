"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionSpinner } from "@/components/action-feedback";
import { HydrationSuccessCelebration } from "@/components/hydration-success-celebration";
import {
  completeHydrationFeedback,
  prepareHydrationFeedback,
} from "@/lib/application/celebration/hydration-feedback";
import type { ApiResponse } from "@/lib/contracts/api-response";
import { toNfcHydrationSuccessPayload } from "@/lib/contracts/hydration-success";
import type { NfcCompletionResult } from "@/lib/contracts/nfc";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

type NfcCompletionAction = "full" | "half";

type PendingConfirmation = {
  action: NfcCompletionAction;
  idempotencyKey: string;
  occurredAt: string;
};

function formatCheckpoint(value: string | null, timezone: string): string {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(value))
    : "No checkpoint";
}

export function NfcConfirmation({
  initialCompletedBottleCount,
  initialConsumedMl,
  initialGoalMl,
  initialNextCheckpointAt,
  normalFillMl,
  timezone,
  identifier,
  unit,
}: {
  initialCompletedBottleCount: number;
  initialConsumedMl: number;
  initialGoalMl: number | null;
  initialNextCheckpointAt: string | null;
  normalFillMl: number;
  timezone: string;
  identifier: string;
  unit: VolumeUnit;
}) {
  const router = useRouter();
  const submissionLockRef = useRef(false);
  const [pendingAction, setPendingAction] = useState<
    NfcCompletionAction | "cancel" | "today" | null
  >(null);
  const [request, setRequest] = useState<PendingConfirmation | null>(null);
  const [recentWarning, setRecentWarning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<NfcCompletionResult | null>(null);
  const halfFillMl = Math.max(1, Math.round(normalFillMl / 2));
  const isPending = pendingAction !== null;

  function viewToday() {
    if (isPending) {
      return;
    }

    setPendingAction("today");
    router.push("/today");
    router.refresh();
  }

  function cancel() {
    if (isPending) {
      return;
    }

    setPendingAction("cancel");
    const referrer = document.referrer;

    if (
      window.history.length > 1 &&
      referrer &&
      new URL(referrer).origin === window.location.origin
    ) {
      router.back();
      return;
    }

    router.push("/today");
    router.refresh();
  }

  async function submit(action: NfcCompletionAction, confirmRecent: boolean) {
    if (submissionLockRef.current) {
      return;
    }

    const preparedFeedback = prepareHydrationFeedback();
    submissionLockRef.current = true;
    const currentRequest =
      request?.action === action
        ? request
        : {
            action,
            idempotencyKey: crypto.randomUUID(),
            occurredAt: new Date().toISOString(),
          };

    setRequest(currentRequest);
    setPendingAction(action);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/nfc-tags/complete", {
        body: JSON.stringify({
          action,
          confirmRecent,
          idempotencyKey: currentRequest.idempotencyKey,
          occurredAt: currentRequest.occurredAt,
          identifier,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload =
        (await response.json()) as ApiResponse<NfcCompletionResult>;

      if (payload.error) {
        if (payload.error.code === "RECENT_COMPLETION") {
          setRecentWarning(true);
          setMessage(payload.error.message);
          return;
        }

        setMessage(payload.error.message);
        return;
      }

      const success = toNfcHydrationSuccessPayload(payload.data);
      setResult(payload.data);
      completeHydrationFeedback(preparedFeedback, success);
      setRecentWarning(false);
      setRequest(null);
    } catch {
      setMessage(
        "HydroPOP could not reach the server. Try again safely; the same request key will be reused.",
      );
    } finally {
      submissionLockRef.current = false;
      setPendingAction(null);
    }
  }

  if (result) {
    const success = toNfcHydrationSuccessPayload(result);

    return (
      <section className="mt-7">
        <HydrationSuccessCelebration result={success} unit={unit} />
        <div className="mt-4 grid grid-cols-2 gap-3 text-left">
          <div className="min-w-0 rounded-2xl bg-white p-3">
            <p className="text-brand-secondary/40 text-[0.65rem] font-bold uppercase">
              Current total
            </p>
            <p className="text-brand-secondary mt-1 text-sm font-bold">
              {formatDisplayVolume(result.daySummary.consumedMl, unit)} {unit}
              {result.daySummary.goalMl
                ? ` / ${formatDisplayVolume(
                    result.daySummary.goalMl,
                    unit,
                  )} ${unit}`
                : ""}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl bg-white p-3">
            <p className="text-brand-secondary/40 text-[0.65rem] font-bold uppercase">
              Bottles today
            </p>
            <p className="text-brand-secondary mt-1 text-sm font-bold">
              {result.daySummary.completedBottleCount}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold text-emerald-900/65">
          Next checkpoint:{" "}
          {formatCheckpoint(
            result.coaching.nextCheckpoint?.targetAt ?? null,
            timezone,
          )}
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={viewToday}
          className="bg-brand-primary mt-5 inline-flex h-14 w-full items-center justify-center rounded-2xl px-5 text-sm font-bold text-white"
        >
          {pendingAction === "today" ? (
            <span className="inline-flex items-center gap-2">
              <ActionSpinner />
              Opening Today…
            </span>
          ) : (
            "View Today"
          )}
        </button>
      </section>
    );
  }

  return (
    <section className="mt-7">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-brand-bg min-w-0 rounded-2xl p-3">
          <p className="text-brand-secondary/40 text-[0.62rem] font-bold uppercase">
            Today
          </p>
          <p className="text-brand-secondary mt-1 text-xs font-bold">
            {formatDisplayVolume(initialConsumedMl, unit)} {unit}
          </p>
        </div>
        <div className="bg-brand-bg min-w-0 rounded-2xl p-3">
          <p className="text-brand-secondary/40 text-[0.62rem] font-bold uppercase">
            Goal
          </p>
          <p className="text-brand-secondary mt-1 text-xs font-bold">
            {initialGoalMl === null
              ? "Not set"
              : `${formatDisplayVolume(initialGoalMl, unit)} ${unit}`}
          </p>
        </div>
        <div className="bg-brand-bg min-w-0 rounded-2xl p-3">
          <p className="text-brand-secondary/40 text-[0.62rem] font-bold uppercase">
            Bottles
          </p>
          <p className="text-brand-secondary mt-1 text-xs font-bold">
            {initialCompletedBottleCount}
          </p>
        </div>
      </div>

      {recentWarning ? (
        <div role="alert" className="mt-4 rounded-2xl bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            You recorded this bottle less than a minute ago.
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900/65">
            Record another full bottle anyway?
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void submit("full", true)}
            className="mt-4 h-14 w-full rounded-2xl bg-amber-700 px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {pendingAction === "full" ? (
              <span className="inline-flex items-center gap-2">
                <ActionSpinner />
                Recording…
              </span>
            ) : (
              "Yes, record another bottle"
            )}
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => void submit("full", false)}
            className="bg-brand-primary hover:bg-brand-primary/90 min-h-16 w-full rounded-2xl px-6 py-4 text-lg font-bold text-white shadow-lg shadow-[rgba(62,41,255,0.2)] disabled:cursor-wait disabled:opacity-60"
          >
            {pendingAction === "full" ? (
              <span className="inline-flex items-center gap-2">
                <ActionSpinner />
                Recording…
              </span>
            ) : (
              "Record one bottle"
            )}
          </button>
          <p className="text-brand-secondary/45 -mt-1 text-center text-xs">
            Full · {formatDisplayVolume(normalFillMl, unit)} {unit}
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => void submit("half", false)}
            className="border-brand-primary/20 text-brand-primary min-h-14 w-full rounded-2xl border bg-white px-5 py-3 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
          >
            {pendingAction === "half" ? (
              <span className="inline-flex items-center gap-2">
                <ActionSpinner />
                Recording…
              </span>
            ) : (
              `Record half — ${formatDisplayVolume(halfFillMl, unit)} ${unit}`
            )}
          </button>
        </div>
      )}

      {message ? (
        <p
          role={recentWarning ? undefined : "alert"}
          className="mt-3 text-center text-xs font-semibold text-red-700"
        >
          {message}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isPending}
        onClick={viewToday}
        className="border-brand-primary/20 text-brand-primary mt-5 h-14 w-full rounded-2xl border bg-white px-5 text-sm font-bold"
      >
        {pendingAction === "today" ? (
          <span className="inline-flex items-center gap-2">
            <ActionSpinner />
            Opening Today…
          </span>
        ) : (
          "View Today"
        )}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={cancel}
        className="text-brand-secondary/55 mt-2 min-h-12 w-full rounded-2xl px-5 text-sm font-semibold"
      >
        {pendingAction === "cancel" ? "Closing…" : "Cancel"}
      </button>

      <p className="text-brand-secondary/40 mt-3 text-center text-xs">
        Next checkpoint: {formatCheckpoint(initialNextCheckpointAt, timezone)}
      </p>
    </section>
  );
}
