import { createHash, randomBytes } from "node:crypto";

import { isValidPhysicalDeviceToken } from "@/lib/contracts/physical-device";

export const physicalDeviceTokenEntropyBytes = 32;

type RandomSource = (size: number) => Uint8Array;

export function generatePhysicalDeviceToken(
  randomSource: RandomSource = randomBytes,
): string {
  const token = Buffer.from(
    randomSource(physicalDeviceTokenEntropyBytes),
  ).toString("base64url");

  if (!isValidPhysicalDeviceToken(token)) {
    throw new Error("Secure physical-device token generation failed.");
  }

  return token;
}

export function hashPhysicalDeviceToken(token: string): string {
  if (!isValidPhysicalDeviceToken(token)) {
    throw new Error("Invalid physical-device token format.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}
