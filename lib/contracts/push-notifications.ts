import { z } from "zod";

const base64UrlSchema = z
  .string()
  .trim()
  .min(8)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+={0,2}$/);

function isSafePushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const privateIpv4 =
      /^(?:0|10|127|169\.254|192\.168)(?:\.|$)/u.test(hostname) ||
      /^172\.(?:1[6-9]|2[0-9]|3[01])\./u.test(hostname);

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      hostname.includes(".") &&
      !hostname.endsWith(".local") &&
      !hostname.includes(":") &&
      !privateIpv4
    );
  } catch {
    return false;
  }
}

export const pushSubscriptionInputSchema = z
  .object({
    endpoint: z.url().max(2048).refine(isSafePushEndpoint),
    expirationTime: z
      .number()
      .int()
      .nonnegative()
      .max(8_640_000_000_000_000)
      .nullable(),
    keys: z
      .object({
        auth: base64UrlSchema.max(256),
        p256dh: base64UrlSchema,
      })
      .strict(),
  })
  .strict();

export const pushSubscriptionRemovalSchema = z
  .object({ endpoint: z.url().max(2048) })
  .strict();

export const notificationPreferenceInputSchema = z
  .object({
    paceRemindersEnabled: z.boolean(),
    reminderFrequency: z.enum(["gentle", "balanced", "frequent"]).optional(),
  })
  .strict();

export const testPushInputSchema = pushSubscriptionRemovalSchema;

type PacePushNotificationPayload = {
  body: string;
  kind: "pace-reminder";
  tag: "hydropop-pace";
  target: "/today?record=1&source=push";
  title: string;
  version: 1;
};

type TestPushNotificationPayload = {
  body: string;
  kind: "test";
  tag: `hydropop-test-${string}`;
  target: "/today";
  title: string;
  version: 1;
};

export type PushNotificationPayload =
  PacePushNotificationPayload | TestPushNotificationPayload;
