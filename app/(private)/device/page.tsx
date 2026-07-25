import { DeviceIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { PlaceholderPanel } from "@/components/placeholder-panel";

export default function DevicePage() {
  return (
    <>
      <PageHeader
        eyebrow="Connections"
        title="Device"
        description="Manage supported device links and review connection health from one place."
      />
      <PlaceholderPanel
        title="No device connected"
        description="Device ingestion will be designed around authenticated tokens and idempotency keys. No Bluetooth or native integration is included."
      >
        <div className="bg-brand-primary/10 text-brand-primary mt-7 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold">
          <DeviceIcon className="size-4" />
          Foundation only
        </div>
      </PlaceholderPanel>
    </>
  );
}
