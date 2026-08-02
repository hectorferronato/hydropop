import { NextResponse } from "next/server";

import {
  errorResponse,
  successResponse,
  type ApiErrorCode,
} from "@/lib/contracts/api-response";

const statusByErrorCode: Record<ApiErrorCode, number> = {
  BOTTLE_NOT_FOUND: 404,
  DEVICE_NOT_FOUND: 404,
  DUPLICATE_EVENT: 409,
  EVENT_ALREADY_REVERSED: 409,
  EVENT_IN_FUTURE: 422,
  EVENT_TOO_OLD: 422,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
  HYDRATION_WRITE_FAILED: 500,
  INVALID_INPUT: 400,
  INVALID_REVERSAL: 422,
  NO_ACTIVE_BOTTLE_CYCLE: 409,
  NO_ACTIVE_GOAL: 409,
  NO_PRIMARY_BOTTLE: 409,
  PRIMARY_BOTTLE_REQUIRED: 409,
  PILOT_TAG_ACTIVATION_REQUIRED: 409,
  PILOT_TAG_CONFLICT: 409,
  PILOT_TAG_UNAVAILABLE: 404,
  NFC_TAG_NOT_FOUND: 404,
  NFC_TAG_REVOKED: 409,
  NFC_TAG_UNAVAILABLE: 404,
  NFC_CODE_UNAVAILABLE: 409,
  RECENT_COMPLETION: 409,
  UNAUTHENTICATED: 401,
};

export function apiSuccess<Data>(data: Data, status = 200) {
  return NextResponse.json(successResponse(data), { status });
}

export function apiFailure(code: ApiErrorCode) {
  return NextResponse.json(errorResponse(code), {
    status: statusByErrorCode[code],
  });
}
