import type { Metadata } from "next";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import { getPublicVapidKey } from "@/lib/infrastructure/push/config";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { createPushServerClient } from "@/lib/infrastructure/supabase/push-server";

import { NotificationSettings } from "./notification-settings";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Notification settings",
};

export default async function NotificationSettingsPage() {
  await connection();
  const user = await requireAllowedUser("/settings/notifications");
  const supabase = await createPushServerClient();
  const [preferenceResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("hydration_notification_preferences")
      .select("pace_reminders_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("web_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
  ]);

  if (preferenceResult.error || subscriptionsResult.error) {
    console.error("[HydroPOP] Notification settings query failed.", {
      preferenceCode: preferenceResult.error?.code,
      subscriptionCode: subscriptionsResult.error?.code,
    });
    throw new Error("Notification settings could not be loaded safely.");
  }

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Hydration reminders"
        description="Opt in to occasional pace check-ins on devices you choose. HydroPOP never records water from a notification tap."
      />
      <NotificationSettings
        activeDeviceCount={subscriptionsResult.count ?? 0}
        initialEnabled={preferenceResult.data?.pace_reminders_enabled ?? false}
        vapidPublicKey={getPublicVapidKey()}
      />
    </>
  );
}
