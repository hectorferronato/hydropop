"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse } from "@/lib/contracts/api-response";
import type { HydrationTimelineEvent } from "@/lib/domain/hydration/event-types";
import {
  getDateInTimezone,
  getLocalTimeInTimezone,
} from "@/lib/domain/hydration/hydration-day";
import {
  canEditRecording,
  recordingSourceLabel,
} from "@/lib/domain/hydration/recording-history";
import {
  formatDisplayVolume,
  millilitersToOunces,
  type VolumeUnit,
} from "@/lib/units/volume";

export function RecordingActions({
  event,
  timezone,
  unit,
}: {
  event: HydrationTimelineEvent;
  timezone: string;
  unit: VolumeUnit;
}) {
  const router = useRouter();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const retry = useRef<{ body: string; key: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<"edit" | "remove">("edit");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [complete, setComplete] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  function open(next: "edit" | "remove") {
    setAction(next);
    setMenuOpen(false);
    setError(null);
    setComplete(false);
    setUncertain(false);
    retry.current = null;
    setAmount(
      String(
        unit === "ml"
          ? event.volumeMl
          : Number(millilitersToOunces(event.volumeMl ?? 0).toFixed(3)),
      ),
    );
    setDate(getDateInTimezone(timezone, new Date(event.occurredAt)));
    setTime(getLocalTimeInTimezone(timezone, new Date(event.occurredAt)));
    setDialogOpen(true);
  }
  useLayoutEffect(() => {
    if (!dialogOpen) return;
    dialog.current?.showModal();
    dialog.current
      ?.querySelector<HTMLElement>(
        action === "remove" ? 'button[type="button"]' : "input",
      )
      ?.focus();
  }, [dialogOpen, action]);

  function close() {
    if (lock.current) return;
    dialog.current?.close();
    trigger.current?.focus();
  }
  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (lock.current || complete) return;
    lock.current = true;
    setPending(true);
    setError(null);
    const request = {
      action,
      eventId: event.id,
      ...(action === "edit"
        ? {
            amount: Number(amount),
            unit,
            date,
            time: time.length === 5 ? `${time}:00` : time,
          }
        : {}),
    };
    const body = JSON.stringify(request);
    if (!retry.current || retry.current.body !== body)
      retry.current = { body, key: crypto.randomUUID() };
    try {
      const response = await fetch("/api/v1/hydration-events/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          idempotencyKey: retry.current.key,
        }),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (payload.error) {
        setUncertain(response.status >= 500);
        setError(
          payload.error.code === "EVENT_ALREADY_REVERSED"
            ? "This recording has changed. Close and refresh to see the latest version."
            : payload.error.code === "EVENT_IN_FUTURE"
              ? "Choose a date and time that isn’t in the future."
              : payload.error.message,
        );
        return;
      }
      setComplete(true);
      dialog.current?.close();
      // Focus survives removal of the row after refresh.
      document.getElementById("hydration-history")?.focus();
      router.refresh();
    } catch {
      setUncertain(true);
      setError(
        "We couldn’t confirm the change. Retry to safely check the same request.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <div className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-label={`Recording options: ${formatDisplayVolume(event.creditedVolumeMl, unit)} ${unit}, ${recordingSourceLabel(event)}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={`${id}-menu`}
        className="text-brand-secondary size-11 rounded-xl text-xl hover:bg-black/5 focus-visible:outline-2"
        onClick={() => {
          setMenuOpen(!menuOpen);
          if (!menuOpen)
            requestAnimationFrame(() =>
              menu.current?.querySelector<HTMLButtonElement>("button")?.focus(),
            );
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setMenuOpen(true);
            requestAnimationFrame(() =>
              menu.current?.querySelector<HTMLButtonElement>("button")?.focus(),
            );
          }
        }}
      >
        •••
      </button>
      {menuOpen && (
        <div
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-label="Recording actions"
          className="absolute right-0 z-20 w-36 rounded-xl border border-black/10 bg-white p-1 shadow-lg"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false);
          }}
          onKeyDown={(e) => {
            const buttons = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
            );
            if (e.key === "Escape") {
              setMenuOpen(false);
              trigger.current?.focus();
            }
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              buttons[
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (e.key === "ArrowDown" ? 1 : -1) +
                        buttons.length) %
                      buttons.length
              ]?.focus();
            }
          }}
        >
          {canEditRecording(event) && (
            <button
              type="button"
              role="menuitem"
              className="min-h-11 w-full rounded-lg px-3 text-left hover:bg-black/5"
              onClick={() => open("edit")}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="min-h-11 w-full rounded-lg px-3 text-left text-red-700 hover:bg-red-50"
            onClick={() => open("remove")}
          >
            Remove
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className="text-brand-secondary fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-7"
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const elements = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              "input:not(:disabled), button:not(:disabled)",
            ),
          );
          const first = elements[0];
          const last = elements.at(-1);
          if (!first || !last) {
            e.preventDefault();
            return;
          }
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={() => {
          setDialogOpen(false);
          if (!complete) trigger.current?.focus();
        }}
      >
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <h2 id={`${id}-title`} className="text-xl font-bold">
            {action === "edit" ? "Edit recording" : "Remove recording?"}
          </h2>
          <p id={`${id}-description`} className="text-sm">
            {action === "edit"
              ? `Date and time in ${timezone}. Amount must be 1–10,000 mL (or equivalent oz).`
              : `${formatDisplayVolume(event.creditedVolumeMl, unit)} ${unit} recorded at ${getLocalTimeInTimezone(timezone, new Date(event.occurredAt)).slice(0, 5)} from ${recordingSourceLabel(event)}. Your hydration totals and progress will be recalculated.`}
          </p>
          {action === "edit" && (
            <fieldset
              disabled={pending || uncertain}
              className="min-w-0 space-y-3 disabled:opacity-60"
            >
              <label
                className="block text-sm font-semibold"
                htmlFor={`${id}-amount`}
              >
                Amount ({unit})
              </label>
              <input
                id={`${id}-amount`}
                required
                type="number"
                min="0.001"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-xl border border-black/20 px-3"
              />
              <label
                className="block text-sm font-semibold"
                htmlFor={`${id}-date`}
              >
                Date
              </label>
              <input
                id={`${id}-date`}
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-xl border border-black/20 px-3"
              />
              <label
                className="block text-sm font-semibold"
                htmlFor={`${id}-time`}
              >
                Time
              </label>
              <input
                id={`${id}-time`}
                required
                type="time"
                step="1"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="min-h-11 w-full min-w-0 rounded-xl border border-black/20 px-3"
              />
            </fieldset>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              autoFocus={action === "remove"}
              type="button"
              disabled={pending}
              onClick={close}
              className="min-h-11 rounded-xl border border-black/15 px-4 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || complete}
              className={`min-h-11 rounded-xl px-4 font-semibold disabled:opacity-50 ${action === "remove" ? "bg-red-700 text-white" : "bg-brand-primary text-white"}`}
            >
              {pending
                ? "Saving…"
                : uncertain
                  ? "Retry change"
                  : action === "edit"
                    ? "Save changes"
                    : "Remove recording"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
