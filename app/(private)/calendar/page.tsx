import { CalendarIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { PlaceholderPanel } from "@/components/placeholder-panel";

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Calendar"
        description="Review hydration days and spot patterns over time once event tracking is available."
      />
      <PlaceholderPanel
        title="Your history will live here"
        description="Calendar summaries will respect your IANA timezone and derive each day from immutable hydration events."
      >
        <div className="bg-brand-primary/10 text-brand-primary mt-7 flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold">
          <CalendarIcon className="size-5" />
          Calendar data is not available yet
        </div>
      </PlaceholderPanel>
    </>
  );
}
