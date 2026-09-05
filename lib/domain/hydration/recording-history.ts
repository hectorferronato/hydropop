import type {
  HydrationEvent,
  HydrationSource,
  HydrationTimelineEvent,
} from "./event-types";

const sourceLabels: Record<HydrationSource, string> = {
  nfc: "NFC",
  web: "App",
  device: "Physical button",
  simulator: "Simulator",
  mobile: "Mobile app",
  charm: "Charm",
  admin: "Administrator",
};
export function recordingSourceLabel(
  event: Pick<HydrationEvent, "source" | "correctsEventId">,
): string {
  return `${sourceLabels[event.source]}${event.correctsEventId ? " · Edited" : ""}`;
}
export function effectiveRecordingHistory(
  events: readonly HydrationTimelineEvent[],
) {
  return events.filter(
    (event) => event.isEffective && event.eventType !== "event_reversed",
  );
}
export function canEditRecording(event: HydrationEvent) {
  return (
    event.eventType !== "fill_started" && event.eventType !== "event_reversed"
  );
}
