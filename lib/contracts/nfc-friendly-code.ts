export const nfcFriendlyCodePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const reservedNfcFriendlyCodes = new Set([
  "admin",
  "api",
  "auth",
  "calendar",
  "community",
  "create",
  "device",
  "devices",
  "login",
  "logout",
  "new",
  "null",
  "profile",
  "settings",
  "setup",
  "today",
  "undefined",
]);

export type NfcFriendlyCodeValidation =
  { code: string; error: null } | { code: null; error: string };

export function normalizeNfcFriendlyCode(value: string): string {
  return value.trim().toLowerCase();
}

export function validateNfcFriendlyCode(
  value: string,
): NfcFriendlyCodeValidation {
  const code = normalizeNfcFriendlyCode(value);

  if (code.length < 3 || code.length > 32) {
    return {
      code: null,
      error: "Use between 3 and 32 characters.",
    };
  }

  if (!nfcFriendlyCodePattern.test(code)) {
    return {
      code: null,
      error: "Use lowercase letters, numbers, and single hyphens only.",
    };
  }

  if (reservedNfcFriendlyCodes.has(code)) {
    return {
      code: null,
      error: "That code is reserved by HydroPOP.",
    };
  }

  return { code, error: null };
}
