"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApiResponse } from "@/lib/contracts/api-response";
import type { ProcessHydrationEventResult } from "@/lib/contracts/hydration-events";
import type {
  HydrationEventType,
  HydrationTimelineEvent,
} from "@/lib/domain/hydration/event-types";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

type IntendedAction = {
  eventType: HydrationEventType;
  label: string;
  volumeMl?: number;
};

const adjustmentAmountMl = 250;

export function DevelopmentControls({
  bottleId,
  latestReversibleEvent,
  unit,
}: {
  bottleId: string;
  latestReversibleEvent: HydrationTimelineEvent | null;
  unit: VolumeUnit;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latestReversible = latestReversibleEvent;
  const actions: IntendedAction[] = [
    { eventType: "fill_started", label: "Start first fill" },
    { eventType: "refill", label: "Refill" },
    { eventType: "bottle_finished", label: "Finish bottle" },
    {
      eventType: "manual_intake",
      label: `Manual +${formatDisplayVolume(adjustmentAmountMl, unit)} ${unit}`,
      volumeMl: adjustmentAmountMl,
    },
    {
      eventType: "adjustment",
      label: `Adjust +${formatDisplayVolume(adjustmentAmountMl, unit)} ${unit}`,
      volumeMl: adjustmentAmountMl,
    },
    {
      eventType: "adjustment",
      label: `Adjust −${formatDisplayVolume(adjustmentAmountMl, unit)} ${unit}`,
      volumeMl: -adjustmentAmountMl,
    },
  ];

  async function submitAction(action: IntendedAction) {
    setPendingAction(action.label);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/hydration-events", {
        body: JSON.stringify({
          bottleId,
          eventType: action.eventType,
          idempotencyKey: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
          source: "simulator",
          ...(action.volumeMl === undefined
            ? {}
            : { volumeMl: action.volumeMl }),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload =
        (await response.json()) as ApiResponse<ProcessHydrationEventResult>;

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      setMessage(
        payload.data.duplicate
          ? "That action was already processed."
          : "Hydration event recorded.",
      );
      router.refresh();
    } catch {
      setMessage("The development control could not reach HydroPOP.");
    } finally {
      setPendingAction(null);
    }
  }

  async function reverseLatest() {
    if (!latestReversible) {
      return;
    }

    const label = "Reverse latest event";
    setPendingAction(label);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/hydration-events", {
        body: JSON.stringify({
          bottleId: latestReversible.bottleId,
          eventType: "event_reversed",
          idempotencyKey: crypto.randomUUID(),
          occurredAt: new Date().toISOString(),
          reversesEventId: latestReversible.id,
          source: "simulator",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload =
        (await response.json()) as ApiResponse<ProcessHydrationEventResult>;

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      setMessage("The event was reversed without changing its audit record.");
      router.refresh();
    } catch {
      setMessage("The development control could not reach HydroPOP.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="mt-6 rounded-[1.75rem] border border-dashed border-amber-300 bg-amber-50/80 p-5">
      <p className="text-xs font-bold tracking-[0.14em] text-amber-700 uppercase">
        Development controls
      </p>
      <p className="mt-2 text-xs leading-5 text-amber-900/60">
        These controls use the same versioned API as future clients and are
        excluded from production builds.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((action) => (
          <button
            key={`${action.eventType}-${action.volumeMl ?? "none"}`}
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void submitAction(action)}
            className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-50"
          >
            {pendingAction === action.label ? "Saving…" : action.label}
          </button>
        ))}
        <button
          type="button"
          disabled={pendingAction !== null || !latestReversible}
          onClick={() => void reverseLatest()}
          className="rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pendingAction === "Reverse latest event"
            ? "Reversing…"
            : "Reverse latest event"}
        </button>
      </div>
      {message ? (
        <p role="status" className="mt-3 text-xs font-semibold text-amber-900">
          {message}
        </p>
      ) : null}
    </section>
  );
}
