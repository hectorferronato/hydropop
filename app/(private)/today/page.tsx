import { PageHeader } from "@/components/page-header";
import { PlaceholderPanel } from "@/components/placeholder-panel";

const previewCards = [
  { label: "Daily goal", value: "Not set" },
  { label: "Consumed", value: "— ml" },
  { label: "Next check-in", value: "Coming soon" },
] as const;

export default function TodayPage() {
  return (
    <>
      <PageHeader
        eyebrow="Your hydration day"
        title="Good to see you."
        description="This will become your calm, at-a-glance home for hydration progress. The foundation is ready; tracking comes next."
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {previewCards.map((card) => (
          <section
            key={card.label}
            className="border-brand-secondary/5 rounded-3xl border bg-white/75 p-5"
          >
            <p className="text-brand-secondary/40 text-xs font-semibold">
              {card.label}
            </p>
            <p className="text-brand-secondary mt-2 text-lg font-bold tracking-tight">
              {card.value}
            </p>
          </section>
        ))}
      </div>

      <PlaceholderPanel
        title="Hydration logging is the next pour"
        description="Drinks, progress, daily goals, and coaching have intentionally not been added yet. This space is ready for the domain model in the next task."
      >
        <div className="bg-brand-primary/10 mt-7 h-2 overflow-hidden rounded-full">
          <div className="bg-brand-primary h-full w-[8%] rounded-full" />
        </div>
      </PlaceholderPanel>
    </>
  );
}
