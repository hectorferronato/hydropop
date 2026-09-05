import { z } from "zod";
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
  const [preferenceResult, subscriptionsResult, diagnosticsResult] =
    await Promise.all([
      supabase
        .from("hydration_notification_preferences")
        .select("pace_reminders_enabled, reminder_frequency")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("web_push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
      supabase.rpc("get_push_reminder_diagnostics"),
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
        initialFrequency={z
          .enum(["gentle", "balanced", "frequent"])
          .catch("balanced")
          .parse(preferenceResult.data?.reminder_frequency)}
        initialEnabled={preferenceResult.data?.pace_reminders_enabled ?? false}
        vapidPublicKey={getPublicVapidKey()}
      />
      <section className="mt-6 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-bold">Reminder diagnostics</h2>
        <p className="mt-2 text-sm">
          Last worker observation; refresh for updates. Push acceptance does not
          confirm that a phone displayed the notification.
        </p>
        {diagnosticsResult.error ? (
          <p>Diagnostics unavailable. Please try again.</p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm">
            {Object.entries(
              z
                .record(z.string(), z.union([z.string(), z.number(), z.null()]))
                .catch({})
                .parse(diagnosticsResult.data),
            ).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4">
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>{value ?? "Not yet available"}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </>
  );
}
