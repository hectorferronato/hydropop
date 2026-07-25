import { PageHeader } from "@/components/page-header";
import { PlaceholderPanel } from "@/components/placeholder-panel";

const setupItems = [
  "Profile and timezone",
  "Daily hydration goal",
  "Units and preferences",
] as const;

export default function SetupPage() {
  return (
    <>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Personalize how HydroPOP fits your day. These controls will be activated with the hydration domain."
      />
      <PlaceholderPanel
        title="Setup is ready for your preferences"
        description="Profiles will keep an IANA timezone so hydration-day boundaries stay correct while traveling and across daylight-saving changes."
      >
        <ul className="divide-brand-secondary/5 border-brand-secondary/5 mt-7 divide-y rounded-2xl border">
          {setupItems.map((item) => (
            <li
              key={item}
              className="text-brand-secondary/65 flex items-center justify-between px-4 py-3.5 text-sm font-semibold"
            >
              {item}
              <span className="text-brand-primary" aria-hidden="true">
                →
              </span>
            </li>
          ))}
        </ul>
      </PlaceholderPanel>
    </>
  );
}
