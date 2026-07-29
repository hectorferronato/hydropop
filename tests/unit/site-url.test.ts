import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildNfcUrl,
  getCanonicalSiteUrl,
  normalizeSiteUrl,
} from "@/lib/application/urls/site-url";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

describe("canonical site URL", () => {
  it("reads the canonical origin from NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://hydropop-lake.vercel.app/";

    expect(getCanonicalSiteUrl()).toBe("https://hydropop-lake.vercel.app");
  });

  it("builds the canonical production NFC URL", () => {
    expect(
      buildNfcUrl("https://hydropop-lake.vercel.app", "example-code"),
    ).toBe("https://hydropop-lake.vercel.app/t/example-code");
  });

  it("removes trailing slashes without producing a double slash", () => {
    expect(
      buildNfcUrl("https://hydropop-lake.vercel.app/", "example-code"),
    ).toBe("https://hydropop-lake.vercel.app/t/example-code");
  });

  it("allows the exact local development origin", () => {
    expect(normalizeSiteUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000",
    );
  });

  it.each([
    undefined,
    "",
    "hydropop-lake.vercel.app",
    "http://hydropop-lake.vercel.app",
    "https://hydropop-lake.vercel.app/path",
  ])("fails clearly for missing or invalid origin %s", (value) => {
    expect(() => normalizeSiteUrl(value)).toThrow(/NEXT_PUBLIC_SITE_URL/u);
  });

  it("validates the site URL during Next startup and build", () => {
    const nextConfig = readFileSync(
      resolve(process.cwd(), "next.config.ts"),
      "utf8",
    );

    expect(nextConfig).toContain("getCanonicalSiteUrl();");
  });

  it("contains no obsolete Vercel hostname", () => {
    const obsoleteHost = ["hydropop", "vercel", "app"].join("\\.");

    expect(() =>
      execFileSync(
        "rg",
        [
          "-n",
          obsoleteHost,
          ".",
          "--glob",
          "!node_modules/**",
          "--glob",
          "!.next*/**",
        ],
        { encoding: "utf8" },
      ),
    ).toThrow();
  });
});
