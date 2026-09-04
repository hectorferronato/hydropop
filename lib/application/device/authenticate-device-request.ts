import { isValidPhysicalDeviceToken } from "@/lib/contracts/physical-device";

import { hashPhysicalDeviceToken } from "./token-security";

export function getPhysicalDeviceCredentialHash(
  authorization: string | null,
): string | null {
  if (!authorization) return null;

  const match = /^Bearer ([A-Za-z0-9_-]+)$/u.exec(authorization);
  const token = match?.[1];

  return token && isValidPhysicalDeviceToken(token)
    ? hashPhysicalDeviceToken(token)
    : null;
}
