"use client";

import { useState } from "react";

import type { ApiResponse } from "@/lib/contracts/api-response";
import type { NfcCompletionResult } from "@/lib/contracts/nfc";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

type PendingConfirmation = {
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
  token,
  unit,
}: {
  initialCompletedBottleCount: number;
  initialConsumedMl: number;
  initialGoalMl: number | null;
  initialNextCheckpointAt: string | null;
  normalFillMl: number;
  timezone: string;
  token: string;
  unit: VolumeUnit;
}) {
  const [pending, setPending] = useState(false);
  const [request, setRequest] = useState<PendingConfirmation | null>(null);
  const [recentWarning, setRecentWarning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<NfcCompletionResult | null>(null);

  async function submit(confirmRecent: boolean) {
    const currentRequest = request ?? {
      idempotencyKey: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    };

    setRequest(currentRequest);
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/nfc-tags/complete", {
        body: JSON.stringify({
          confirmRecent,
          idempotencyKey: currentRequest.idempotencyKey,
          occurredAt: currentRequest.occurredAt,
          token,
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

      setResult(payload.data);
      setRecentWarning(false);
      setRequest(null);
    } catch {
      setMessage(
        "HydroPOP could not reach the server. Try again safely; the same request key will be reused.",
      );
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <section
        role="status"
        className="mt-7 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5 text-center"
      >
        <p className="text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">
          Bottle recorded
        </p>
        <p className="text-brand-secondary mt-3 text-3xl font-bold">
          +{formatDisplayVolume(result.creditedAmountMl, unit)} {unit}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-2xl bg-white p-3">
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
          <div className="rounded-2xl bg-white p-3">
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
        <a
          href="/today"
          className="bg-brand-primary mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-bold text-white"
        >
          View Today
        </a>
      </section>
    );
  }

  return (
    <section className="mt-7">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-brand-bg rounded-2xl p-3">
          <p className="text-brand-secondary/40 text-[0.62rem] font-bold uppercase">
            Today
          </p>
          <p className="text-brand-secondary mt-1 text-xs font-bold">
            {formatDisplayVolume(initialConsumedMl, unit)} {unit}
          </p>
        </div>
        <div className="bg-brand-bg rounded-2xl p-3">
          <p className="text-brand-secondary/40 text-[0.62rem] font-bold uppercase">
            Goal
          </p>
          <p className="text-brand-secondary mt-1 text-xs font-bold">
            {initialGoalMl === null
              ? "Not set"
              : `${formatDisplayVolume(initialGoalMl, unit)} ${unit}`}
          </p>
        </div>
        <div className="bg-brand-bg rounded-2xl p-3">
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
            Record another one anyway?
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => void submit(true)}
            className="mt-4 h-12 w-full rounded-2xl bg-amber-700 px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Recording…" : "Yes, record another bottle"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => void submit(false)}
          className="bg-brand-primary hover:bg-brand-primary/90 mt-5 min-h-16 w-full rounded-2xl px-6 py-4 text-lg font-bold text-white shadow-lg shadow-[rgba(62,41,255,0.2)] disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? "Recording…"
            : `Record one bottle · ${formatDisplayVolume(
                normalFillMl,
                unit,
              )} ${unit}`}
        </button>
      )}

      {message ? (
        <p
          role={recentWarning ? undefined : "alert"}
          className="mt-3 text-center text-xs font-semibold text-red-700"
        >
          {message}
        </p>
      ) : null}

      <p className="text-brand-secondary/40 mt-3 text-center text-xs">
        Next checkpoint: {formatCheckpoint(initialNextCheckpointAt, timezone)}
      </p>
    </section>
  );
}
