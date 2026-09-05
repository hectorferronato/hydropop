import { RecordingActions } from "./recording-actions";
import {
  effectiveRecordingHistory,
  recordingSourceLabel,
} from "@/lib/domain/hydration/recording-history";
import type { HydrationTimelineEvent } from "@/lib/domain/hydration/event-types";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

const eventLabels = {
  adjustment: "Adjustment",
  bottle_completed: "Bottle completed",
  bottle_finished: "Bottle finished",
  event_reversed: "Event reversed",
  fill_started: "Bottle filled",
  manual_intake: "Manual intake",
  refill: "Bottle refilled",
} as const;

function formatEventTime(occurredAt: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(occurredAt));
}

export function EventTimeline({
  events,
  timezone,
  unit,
}: {
  events: readonly HydrationTimelineEvent[];
  timezone: string;
  unit: VolumeUnit;
}) {
  const activeEvents = effectiveRecordingHistory(events);
  if (activeEvents.length === 0) {
    return (
      <p
        id="hydration-history"
        tabIndex={-1}
        className="text-brand-secondary/45 py-6 text-sm"
      >
        No hydration recordings for this day.
      </p>
    );
  }

  return (
    <ol
      id="hydration-history"
      tabIndex={-1}
      aria-label="Hydration recordings"
      className="divide-brand-secondary/5 divide-y"
    >
      {[...activeEvents].reverse().map((event) => (
        <li key={event.id} className="flex items-center gap-3 py-4">
          <span className="bg-brand-primary size-2.5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="text-brand-secondary text-sm font-semibold">
              {eventLabels[event.eventType]}
            </p>
            <p className="text-brand-secondary/40 mt-0.5 text-xs">
              {formatEventTime(event.occurredAt, timezone)}
            </p>
            <p className="text-brand-secondary/70 mt-1 text-xs font-medium">
              {recordingSourceLabel(event)}
            </p>
          </div>
          <span className="text-brand-secondary text-sm font-bold">
            {event.eventType === "fill_started"
              ? "0"
              : `${event.creditedVolumeMl > 0 ? "+" : ""}${formatDisplayVolume(
                  event.creditedVolumeMl,
                  unit,
                )}`}{" "}
            {unit}
          </span>
          <RecordingActions event={event} timezone={timezone} unit={unit} />
        </li>
      ))}
    </ol>
  );
}
