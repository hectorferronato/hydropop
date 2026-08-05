"use client";

import { useEffect, useState } from "react";

import { ActionSpinner } from "@/components/action-feedback";
import type { ApiResponse } from "@/lib/contracts/api-response";

type FeatureState =
  "checking" | "not-supported" | "ios-install-required" | "ready";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

async function apiRequest<Data>(
  path: string,
  method: "DELETE" | "POST" | "PUT",
  body: unknown,
): Promise<Data> {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  });
  const payload = (await response.json()) as ApiResponse<Data>;
  if (payload.error) throw new Error(payload.error.message);
  return payload.data;
}

function subscriptionInput(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.keys?.auth || !json.keys.p256dh) {
    throw new Error("This browser did not provide valid push encryption keys.");
  }
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: { auth: json.keys.auth, p256dh: json.keys.p256dh },
  };
}

export function NotificationSettings({
  activeDeviceCount,
  initialEnabled,
  vapidPublicKey,
}: {
  activeDeviceCount: number;
  initialEnabled: boolean;
  vapidPublicKey: string | null;
}) {
  const [featureState, setFeatureState] = useState<FeatureState>("checking");
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [showAndroidInstallGuidance, setShowAndroidInstallGuidance] =
    useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [enabled, setEnabled] = useState(initialEnabled);
  const [deviceCount, setDeviceCount] = useState(activeDeviceCount);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      await Promise.resolve();
      const isSupported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (cancelled) return;
      if (!isSupported) {
        setFeatureState("not-supported");
        return;
      }

      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && navigator.standalone === true);
      setPermission(Notification.permission);
      setShowAndroidInstallGuidance(isAndroid && !isStandalone);
      if (isIos && !isStandalone) {
        setFeatureState("ios-install-required");
        return;
      }

      setFeatureState("ready");
      try {
        const registration = await navigator.serviceWorker.ready;
        const currentSubscription =
          await registration.pushManager.getSubscription();
        if (!cancelled) setSubscription(currentSubscription);
      } catch {
        if (!cancelled) {
          setError("This device’s notification state could not be read.");
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  async function enableThisDevice() {
    clearFeedback();
    if (!vapidPublicKey) {
      setError("Push notifications are not configured for this environment.");
      return;
    }
    setPending("enable");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setError(
          nextPermission === "denied"
            ? "Notifications are blocked in this browser’s settings."
            : "Notification permission was not granted.",
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const nextSubscription =
        existing ??
        (await registration.pushManager.subscribe({
          applicationServerKey: applicationServerKey(vapidPublicKey),
          userVisibleOnly: true,
        }));
      await apiRequest(
        "/api/v1/push-subscriptions",
        "POST",
        subscriptionInput(nextSubscription),
      );
      await apiRequest("/api/v1/notification-preferences", "PUT", {
        paceRemindersEnabled: true,
      });
      setSubscription(nextSubscription);
      setEnabled(true);
      if (!existing) setDeviceCount((count) => count + 1);
      setMessage("Reminders are enabled on this device.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Notifications could not be enabled.",
      );
    } finally {
      setPending(null);
    }
  }

  async function disableThisDevice() {
    if (!subscription) return;
    clearFeedback();
    setPending("disable-device");
    try {
      await apiRequest("/api/v1/push-subscriptions", "DELETE", {
        endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
      setSubscription(null);
      setDeviceCount((count) => Math.max(0, count - 1));
      setMessage("Reminders were removed from this device only.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "This device could not be disabled.",
      );
    } finally {
      setPending(null);
    }
  }

  async function setOverallEnabled(nextEnabled: boolean) {
    clearFeedback();
    setPending("preference");
    try {
      await apiRequest("/api/v1/notification-preferences", "PUT", {
        paceRemindersEnabled: nextEnabled,
      });
      setEnabled(nextEnabled);
      setMessage(
        nextEnabled
          ? "Pace reminders resumed."
          : "Pace reminders paused on every device.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your preference could not be saved.",
      );
    } finally {
      setPending(null);
    }
  }

  async function sendTest() {
    if (!subscription) return;
    clearFeedback();
    setPending("test");
    try {
      await apiRequest("/api/v1/push-notifications/test", "POST", {
        endpoint: subscription.endpoint,
      });
      setMessage("Test notification accepted for this device.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The test notification could not be sent.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      <section className="border-brand-secondary/5 rounded-[1.75rem] border bg-white/85 p-5 sm:p-6">
        <p className="text-brand-primary text-xs font-bold tracking-[0.12em] uppercase">
          This device
        </p>
        <h2 className="text-brand-secondary mt-2 text-xl font-bold">
          {subscription ? "Notifications enabled" : "Enable notifications"}
        </h2>
        <p className="text-brand-secondary/50 mt-2 text-sm leading-6">
          Permission is requested only when you press the enable button. Each
          browser or installed app is managed separately.
        </p>

        {featureState === "checking" ? (
          <p className="mt-5 text-sm">Checking this device…</p>
        ) : null}
        {featureState === "not-supported" ? (
          <p
            role="status"
            className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"
          >
            This browser does not support Web Push. You can keep using HydroPOP
            without reminders.
          </p>
        ) : null}
        {featureState === "ios-install-required" ? (
          <p
            role="status"
            className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          >
            On iPhone or iPad, open HydroPOP in Safari, use Share → Add to Home
            Screen, enable Open as Web App where shown, open the installed
            HydroPOP icon, then return to Profile → Notifications.
          </p>
        ) : null}
        {featureState === "ready" && showAndroidInstallGuidance ? (
          <p
            role="status"
            className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900"
          >
            This browser supports reminders. For an app-like experience on
            Android, use the browser menu to Install app or Add to Home screen,
            then open HydroPOP from its icon.
          </p>
        ) : null}
        {permission === "denied" ? (
          <p
            role="alert"
            className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800"
          >
            Notifications are blocked. Allow HydroPOP in your browser or device
            settings, then reload this page.
          </p>
        ) : null}
        {!vapidPublicKey ? (
          <p
            role="alert"
            className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800"
          >
            Web Push is not configured for this HydroPOP environment.
          </p>
        ) : null}

        {featureState === "ready" && permission !== "denied" ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {subscription ? (
              <>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void sendTest()}
                  className="bg-brand-primary min-h-11 rounded-2xl px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  {pending === "test" ? (
                    <span className="inline-flex items-center gap-2">
                      <ActionSpinner /> Sending…
                    </span>
                  ) : (
                    "Send test"
                  )}
                </button>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void disableThisDevice()}
                  className="border-brand-secondary/10 text-brand-secondary min-h-11 rounded-2xl border px-4 text-sm font-bold disabled:opacity-60"
                >
                  {pending === "disable-device"
                    ? "Disabling…"
                    : "Disable this device"}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending !== null || !vapidPublicKey}
                onClick={() => void enableThisDevice()}
                className="bg-brand-primary min-h-12 rounded-2xl px-5 text-sm font-bold text-white disabled:opacity-60"
              >
                {pending === "enable" ? (
                  <span className="inline-flex items-center gap-2">
                    <ActionSpinner /> Enabling…
                  </span>
                ) : (
                  "Enable reminders"
                )}
              </button>
            )}
          </div>
        ) : null}
      </section>

      <section className="border-brand-secondary/5 rounded-[1.75rem] border bg-white/85 p-5 sm:p-6">
        <p className="text-brand-primary text-xs font-bold tracking-[0.12em] uppercase">
          Reminder preference
        </p>
        <h2 className="text-brand-secondary mt-2 text-xl font-bold">
          Pace check-ins
        </h2>
        <p className="text-brand-secondary/50 mt-2 text-sm leading-6">
          HydroPOP may send a supportive reminder when today’s effective intake
          is behind your configured schedule. No reminder is sent simply because
          you have not opened the app.
        </p>
        <dl className="bg-brand-background mt-5 rounded-2xl p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-brand-secondary/50">Overall status</dt>
            <dd className="text-brand-secondary font-bold">
              {enabled ? "On" : "Paused"}
            </dd>
          </div>
          <div className="mt-3 flex justify-between gap-4">
            <dt className="text-brand-secondary/50">Active devices</dt>
            <dd className="text-brand-secondary font-bold">{deviceCount}</dd>
          </div>
          <div className="mt-3 flex justify-between gap-4">
            <dt className="text-brand-secondary/50">Daily maximum</dt>
            <dd className="text-brand-secondary font-bold">4 reminders</dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={pending !== null || (!enabled && deviceCount === 0)}
          onClick={() => void setOverallEnabled(!enabled)}
          className="border-brand-primary/15 text-brand-primary mt-5 min-h-11 rounded-2xl border px-4 text-sm font-bold disabled:opacity-50"
        >
          {pending === "preference"
            ? "Saving…"
            : enabled
              ? "Pause all reminders"
              : "Resume reminders"}
        </button>
      </section>

      {message ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 lg:col-span-2"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 lg:col-span-2"
        >
          {error}
        </p>
      ) : null}
      <p className="text-brand-secondary/40 text-xs leading-5 lg:col-span-2">
        Notification messages contain only a supportive hydration suggestion.
        They do not contain email, timezone, bottle identifiers, NFC data, raw
        events, or internal account IDs.
      </p>
    </div>
  );
}
