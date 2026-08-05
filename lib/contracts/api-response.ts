export const apiErrorCodes = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "BOTTLE_NOT_FOUND",
  "DEVICE_NOT_FOUND",
  "NO_ACTIVE_BOTTLE_CYCLE",
  "DUPLICATE_EVENT",
  "EVENT_ALREADY_REVERSED",
  "INVALID_REVERSAL",
  "NO_ACTIVE_GOAL",
  "NO_PRIMARY_BOTTLE",
  "NFC_TAG_NOT_FOUND",
  "NFC_TAG_REVOKED",
  "NFC_TAG_UNAVAILABLE",
  "NFC_CODE_UNAVAILABLE",
  "RECENT_COMPLETION",
  "PRIMARY_BOTTLE_REQUIRED",
  "PILOT_TAG_ACTIVATION_REQUIRED",
  "PILOT_TAG_UNAVAILABLE",
  "PILOT_TAG_CONFLICT",
  "PUSH_CONFIGURATION_ERROR",
  "PUSH_SUBSCRIPTION_NOT_FOUND",
  "HYDRATION_WRITE_FAILED",
  "EVENT_TOO_OLD",
  "EVENT_IN_FUTURE",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};

export type ApiResponse<Data> =
  { data: Data; error: null } | { data: null; error: ApiError };

export const safeApiErrorMessages: Record<ApiErrorCode, string> = {
  BOTTLE_NOT_FOUND: "That bottle could not be found.",
  DEVICE_NOT_FOUND: "That device could not be found.",
  DUPLICATE_EVENT: "This hydration event was already processed.",
  EVENT_ALREADY_REVERSED: "That hydration event was already reversed.",
  EVENT_IN_FUTURE: "Hydration events cannot be more than 5 minutes ahead.",
  EVENT_TOO_OLD: "Offline hydration events must be submitted within 7 days.",
  FORBIDDEN: "You do not have permission to perform this action.",
  INTERNAL_ERROR: "HydroPOP could not complete the request.",
  INVALID_INPUT: "Review the request and try again.",
  INVALID_REVERSAL: "That hydration event cannot be reversed.",
  NO_ACTIVE_BOTTLE_CYCLE: "Start a bottle fill before finishing it.",
  NO_ACTIVE_GOAL: "Set an active hydration goal before logging hydration.",
  NO_PRIMARY_BOTTLE:
    "Choose an active primary bottle before logging hydration.",
  PRIMARY_BOTTLE_REQUIRED:
    "Choose an active primary bottle before activating the pilot tag.",
  PILOT_TAG_ACTIVATION_REQUIRED:
    "Activate your HydroPOP pilot tag before recording water.",
  PILOT_TAG_CONFLICT:
    "This account’s historical pilot tag cannot be reactivated automatically. Contact the pilot administrator.",
  PILOT_TAG_UNAVAILABLE: "The HydroPOP pilot tag is unavailable.",
  PUSH_CONFIGURATION_ERROR:
    "Push notifications are not configured for this environment.",
  PUSH_SUBSCRIPTION_NOT_FOUND:
    "This device does not have an active HydroPOP notification subscription.",
  HYDRATION_WRITE_FAILED:
    "HydroPOP could not record water. Please try again safely.",
  NFC_TAG_NOT_FOUND: "That NFC tag could not be found.",
  NFC_TAG_REVOKED: "That NFC tag has been revoked.",
  NFC_TAG_UNAVAILABLE: "This NFC tag is unavailable.",
  NFC_CODE_UNAVAILABLE:
    "That friendly pilot code is unavailable. Choose another code.",
  RECENT_COMPLETION:
    "You recorded this bottle less than a minute ago. Record another one anyway?",
  UNAUTHENTICATED: "Sign in to continue.",
};

export class HydrationApplicationError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message = safeApiErrorMessages[code]) {
    super(message);
    this.code = code;
    this.name = "HydrationApplicationError";
  }
}

export class NfcApplicationError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message = safeApiErrorMessages[code]) {
    super(message);
    this.code = code;
    this.name = "NfcApplicationError";
  }
}

export function successResponse<Data>(data: Data): ApiResponse<Data> {
  return { data, error: null };
}

export function errorResponse(code: ApiErrorCode): ApiResponse<never> {
  return {
    data: null,
    error: { code, message: safeApiErrorMessages[code] },
  };
}
