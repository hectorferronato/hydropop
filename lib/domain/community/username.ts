export const communityUsernamePattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

export const reservedCommunityUsernames = [
  "auth",
  "login",
  "logout",
  "api",
  "admin",
  "setup",
  "settings",
  "device",
  "devices",
  "today",
  "calendar",
  "trends",
  "community",
  "profile",
  "user",
  "users",
  "u",
  "new",
  "create",
  "undefined",
  "null",
  "support",
  "hydropop",
  "system",
] as const;

const reservedCommunityUsernameSet = new Set<string>(
  reservedCommunityUsernames,
);

export type CommunityUsernameValidation =
  | {
      error: null;
      username: string;
    }
  | {
      error: "USERNAME_INVALID" | "USERNAME_RESERVED";
      username: null;
    };

export function normalizeCommunityUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateCommunityUsername(
  value: string,
): CommunityUsernameValidation {
  const username = normalizeCommunityUsername(value);

  if (
    username.length < 3 ||
    username.length > 30 ||
    !communityUsernamePattern.test(username)
  ) {
    return { error: "USERNAME_INVALID", username: null };
  }

  if (reservedCommunityUsernameSet.has(username)) {
    return { error: "USERNAME_RESERVED", username: null };
  }

  return { error: null, username };
}

export function suggestCommunityUsername(displayName: string): string {
  const suggestion = displayName
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ".")
    .replace(/^\.+|\.+$/gu, "")
    .slice(0, 30)
    .replace(/[._-]+$/gu, "");

  return validateCommunityUsername(suggestion).username ?? "";
}
