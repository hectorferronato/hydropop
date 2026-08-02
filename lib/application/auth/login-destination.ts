import type { Route } from "next";

const defaultDestination = "/today";
const privateRoutePattern =
  /^\/(?:calendar|community|device|profile|settings|setup|today|trends)(?:\/.*)?$/u;
const nfcRoutePattern = /^\/t\/[^/?#]+$/u;
const communityMemberRoutePattern = /^\/u\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

function isAllowedPathname(pathname: string): boolean {
  return (
    privateRoutePattern.test(pathname) ||
    nfcRoutePattern.test(pathname) ||
    communityMemberRoutePattern.test(pathname)
  );
}

export function sanitizeLoginDestination(
  value: string | null | undefined,
  fallback = defaultDestination,
): Route {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return fallback as Route;
  }

  try {
    const parsed = new URL(value, "https://hydropop.local");

    if (
      parsed.origin !== "https://hydropop.local" ||
      !isAllowedPathname(parsed.pathname)
    ) {
      return fallback as Route;
    }

    return `${parsed.pathname}${parsed.search}` as Route;
  } catch {
    return fallback as Route;
  }
}

export function createLoginPath(destination: string): Route {
  const parameters = new URLSearchParams({
    next: sanitizeLoginDestination(destination),
  });

  return `/auth/login?${parameters.toString()}` as Route;
}

export function createUnauthorizedPath(destination: string): Route {
  const parameters = new URLSearchParams({
    next: sanitizeLoginDestination(destination),
  });

  return `/auth/unauthorized?${parameters.toString()}` as Route;
}

export function isPilotNfcDestination(destination: string): boolean {
  return String(sanitizeLoginDestination(destination)) === "/t/pilot";
}

export function createSetupPath(
  destination: string,
  options: { completePartialSetup?: boolean } = {},
): Route {
  const parameters = new URLSearchParams();

  if (options.completePartialSetup) {
    parameters.set("mode", "complete");
  }

  if (isPilotNfcDestination(destination)) {
    parameters.set("next", "/t/pilot");
  }

  const query = parameters.toString();
  return (query ? `/setup?${query}` : "/setup") as Route;
}
