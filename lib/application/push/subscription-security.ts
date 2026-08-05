import { createHash } from "node:crypto";

export function hashPushEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint, "utf8").digest("hex");
}

export function describePushPlatform(userAgent: string): string {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macos";
  if (/Windows/i.test(userAgent)) return "windows";
  return "other";
}
