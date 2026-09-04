import { NextResponse } from "next/server";

import type {
  PhysicalDeviceErrorCode,
  PhysicalDeviceErrorResponse,
  PhysicalDeviceHydrationResponse,
  PhysicalDeviceStatusResponse,
} from "@/lib/contracts/physical-device";

const errorMessages: Record<PhysicalDeviceErrorCode, string> = {
  DEVICE_CONFIGURATION_ERROR:
    "The device needs an active bottle configuration.",
  EVENT_IN_FUTURE: "The occurrence time is too far in the future.",
  EVENT_TOO_OLD: "The occurrence time is more than seven days old.",
  INTERNAL_ERROR: "HydroPOP could not complete the request.",
  INVALID_INPUT: "The request is invalid.",
  UNAUTHORIZED: "The device credential is invalid or revoked.",
};

export function physicalDeviceSuccess(
  payload: PhysicalDeviceHydrationResponse | PhysicalDeviceStatusResponse,
  status = 200,
) {
  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
    status,
  });
}

export function physicalDeviceFailure(
  code: PhysicalDeviceErrorCode,
  status: number,
) {
  const payload: PhysicalDeviceErrorResponse = {
    version: 1,
    serverTime: new Date().toISOString(),
    error: { code, message: errorMessages[code] },
  };

  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
    status,
  });
}

export function physicalDeviceRpcFailure(errorCode: string) {
  if (errorCode === "DEVICE_UNAUTHORIZED") {
    return physicalDeviceFailure("UNAUTHORIZED", 401);
  }

  if (
    errorCode === "DEVICE_CONFIGURATION_ERROR" ||
    errorCode === "BOTTLE_NOT_FOUND" ||
    errorCode === "DEVICE_NOT_FOUND" ||
    errorCode === "NO_ACTIVE_GOAL" ||
    errorCode === "NO_PRIMARY_BOTTLE"
  ) {
    return physicalDeviceFailure("DEVICE_CONFIGURATION_ERROR", 409);
  }

  if (errorCode === "EVENT_IN_FUTURE" || errorCode === "EVENT_TOO_OLD") {
    return physicalDeviceFailure(errorCode, 422);
  }

  if (errorCode === "INVALID_INPUT") {
    return physicalDeviceFailure("INVALID_INPUT", 400);
  }

  return physicalDeviceFailure("INTERNAL_ERROR", 500);
}
