import type { Route } from "next";

const defaultDestination = "/today";
const privateRoutePattern =
  /^\/(?:calendar|device|settings|setup|today)(?:\/.*)?$/u;
const nfcRoutePattern = /^\/t\/[^/?#]+$/u;

function isAllowedPathname(pathname: string): boolean {
  return privateRoutePattern.test(pathname) || nfcRoutePattern.test(pathname);
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
