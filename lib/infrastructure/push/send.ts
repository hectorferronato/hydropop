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
  const publicKey = Buffer.from(subscription.p256dh, "base64url");
  const authKey = Buffer.from(subscription.auth, "base64url");
  if (publicKey.length !== 65 || publicKey[0] !== 4 || authKey.length !== 16)
    return false;
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
    { TTL: 900, urgency: "normal", timeout: 10_000 },
  );
}
