import webPush from "web-push";

import {
  pushSubscriptionInputSchema,
  type PushNotificationPayload,
} from "@/lib/contracts/push-notifications";

import { getVapidConfig } from "./config";

export type StoredPushSubscription = {
  auth: string;
  endpoint: string;
  p256dh: string;
};

export function isValidStoredPushSubscription(
  subscription: StoredPushSubscription,
): boolean {
  return pushSubscriptionInputSchema.safeParse({
    endpoint: subscription.endpoint,
    expirationTime: null,
    keys: { auth: subscription.auth, p256dh: subscription.p256dh },
  }).success;
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: PushNotificationPayload,
) {
  const config = getVapidConfig();
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  return await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { auth: subscription.auth, p256dh: subscription.p256dh },
    },
    JSON.stringify(payload),
    { TTL: 900, urgency: "normal" },
  );
}
