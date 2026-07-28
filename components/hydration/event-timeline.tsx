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
  if (events.length === 0) {
    return (
      <p className="text-brand-secondary/45 py-6 text-sm">
        No hydration events yet.
      </p>
    );
  }

  return (
    <ol className="divide-brand-secondary/5 divide-y">
      {[...events].reverse().map((event) => (
        <li key={event.id} className="flex items-center gap-3 py-4">
          <span
            className={`size-2.5 shrink-0 rounded-full ${
              event.isEffective ? "bg-brand-primary" : "bg-brand-secondary/20"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-semibold ${
                event.isEffective
                  ? "text-brand-secondary"
                  : "text-brand-secondary/40 line-through"
              }`}
            >
              {eventLabels[event.eventType]}
            </p>
            <p className="text-brand-secondary/40 mt-0.5 text-xs">
              {formatEventTime(event.occurredAt, timezone)}
              {!event.isEffective ? " · Audit only" : ""}
            </p>
          </div>
          <span className="text-brand-secondary/60 text-xs font-bold">
            {event.eventType === "fill_started"
              ? "0"
              : `${event.creditedVolumeMl > 0 ? "+" : ""}${formatDisplayVolume(
                  event.creditedVolumeMl,
                  unit,
                )}`}{" "}
            {unit}
          </span>
        </li>
      ))}
    </ol>
  );
}
