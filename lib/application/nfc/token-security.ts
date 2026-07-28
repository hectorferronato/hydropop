import { createHash, randomBytes } from "node:crypto";

import { isValidPublicNfcToken } from "@/lib/contracts/nfc-token";

export const nfcTokenEntropyBytes = 32;

type RandomSource = (size: number) => Uint8Array;

export function generateNfcToken(
  randomSource: RandomSource = randomBytes,
): string {
  const token = Buffer.from(randomSource(nfcTokenEntropyBytes)).toString(
    "base64url",
  );

  if (!isValidPublicNfcToken(token)) {
    throw new Error("Secure NFC token generation returned an invalid token.");
  }

  return token;
}

export function hashNfcToken(token: string): string {
  if (!isValidPublicNfcToken(token)) {
    throw new Error("Invalid NFC token format.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function redactNfcToken(token: string): string {
  if (token.length < 12) {
    return "[REDACTED NFC TOKEN]";
  }

  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export function buildNfcUrl(siteUrl: string, token: string): string {
  if (!isValidPublicNfcToken(token)) {
    throw new Error("Invalid NFC token format.");
  }

  return new URL(`/t/${token}`, siteUrl).toString();
}
