import { z } from "zod";

const vapidConfigSchema = z.object({
  privateKey: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{32,120}$/),
  publicKey: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{40,120}$/),
  subject: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^mailto:[^@\s]+@[^@\s]+$/u.test(value) ||
        /^https:\/\/[^\s/$.?#].[^\s]*$/u.test(value),
    ),
});

const workerSecretSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{64}$/);

export function getVapidConfig() {
  const result = vapidConfigSchema.safeParse({
    privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
    publicKey: process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY,
    subject: process.env.WEB_PUSH_SUBJECT,
  });

  if (!result.success) {
    throw new Error("Missing or invalid server Web Push configuration.");
  }

  return result.data;
}

export function getPushWorkerSecret(): string {
  const result = workerSecretSchema.safeParse(process.env.PUSH_WORKER_SECRET);
  if (!result.success) {
    throw new Error("Missing or invalid push worker secret.");
  }
  return result.data;
}

export function getPublicVapidKey(): string | null {
  const value = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  return value && /^[A-Za-z0-9_-]{40,120}$/u.test(value) ? value : null;
}
