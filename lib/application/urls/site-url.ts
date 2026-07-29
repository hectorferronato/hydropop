const localDevelopmentOrigin = "http://localhost:3000";

function isLocalDevelopmentUrl(url: URL): boolean {
  return url.origin === localDevelopmentOrigin;
}

export function normalizeSiteUrl(value: string | undefined): string {
  const candidate = value?.trim();

  if (!candidate) {
    throw new Error(
      "Missing NEXT_PUBLIC_SITE_URL. Configure the canonical HydroPOP origin without a trailing slash.",
    );
  }

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error(
      "Invalid NEXT_PUBLIC_SITE_URL. Configure an absolute HTTPS origin or http://localhost:3000 for local development.",
    );
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SITE_URL. Configure only the application origin, without credentials, a path, query, or fragment.",
    );
  }

  if (url.protocol !== "https:" && !isLocalDevelopmentUrl(url)) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SITE_URL. Production origins must use HTTPS; only http://localhost:3000 is allowed for local development.",
    );
  }

  return url.origin;
}

export function getCanonicalSiteUrl(): string {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

export function buildNfcUrl(siteUrl: string, identifier: string): string {
  const origin = normalizeSiteUrl(siteUrl);
  return `${origin}/t/${encodeURIComponent(identifier)}`;
}
