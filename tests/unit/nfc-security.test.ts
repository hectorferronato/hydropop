import { describe, expect, it, vi } from "vitest";

import { issueNfcCredential } from "@/lib/application/nfc/issue-nfc-credential";
import {
  resolveNfcScan,
  type NfcScanDataSource,
  type ResolvedNfcBottle,
  type ResolvedNfcTag,
} from "@/lib/application/nfc/resolve-nfc-scan";
import {
  generateNfcToken,
  hashNfcToken,
  nfcTokenEntropyBytes,
  redactNfcToken,
} from "@/lib/application/nfc/token-security";
import { isValidPublicNfcToken } from "@/lib/contracts/nfc-token";

const userId = "496a6d01-fc87-4bc5-b025-4d0cf0c2a92c";
const bottleId = "4b7640b8-8a58-4f78-ab38-c79a7d2da7d0";
const tagId = "91aa196f-bf1e-4336-9a15-72613205012e";
const validToken = "A".repeat(43);

const activeBottle: ResolvedNfcBottle = {
  archivedAt: null,
  brand: "Owala",
  capacityMl: 710,
  id: bottleId,
  isPrimary: true,
  model: "FreeSip",
  name: "Work bottle",
  typicalFillMl: 650,
  userId,
};

const activeTag: ResolvedNfcTag = {
  bottleId,
  id: tagId,
  label: "Kitchen",
  lastConfirmedAt: null,
  status: "active",
  userId,
};

function dataSource({
  bottle = activeBottle,
  tag = activeTag,
}: {
  bottle?: ResolvedNfcBottle | null;
  tag?: ResolvedNfcTag | null;
} = {}) {
  return {
    findBottle: vi.fn(async () => bottle),
    findTagByHash: vi.fn(async () => tag),
  } satisfies NfcScanDataSource;
}

describe("NFC token security", () => {
  it("requests at least 256 bits from its cryptographic random source", () => {
    const randomSource = vi.fn((size: number) => new Uint8Array(size).fill(7));

    generateNfcToken(randomSource);

    expect(nfcTokenEntropyBytes).toBeGreaterThanOrEqual(32);
    expect(randomSource).toHaveBeenCalledWith(32);
  });

  it("generates a URL-safe token with no padding", () => {
    const token = generateNfcToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(token).not.toContain("=");
    expect(isValidPublicNfcToken(token)).toBe(true);
  });

  it("hashes tokens deterministically as lowercase SHA-256", () => {
    expect(hashNfcToken(validToken)).toBe(
      "0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a",
    );
    expect(hashNfcToken(validToken)).toBe(hashNfcToken(validToken));
    expect(hashNfcToken(validToken)).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("redacts tokens without returning the complete secret", () => {
    const redacted = redactNfcToken(validToken);

    expect(redacted).toBe("AAAA…AAAA");
    expect(redacted).not.toBe(validToken);
    expect(redactNfcToken("short")).toBe("[REDACTED NFC TOKEN]");
  });

  it("passes only a hash to persistence while returning the raw token once", async () => {
    const hashes: string[] = [];
    const issued = await issueNfcCredential({
      mutate: async (tokenHash) => {
        hashes.push(tokenHash);
        return { data: { id: tagId }, error: null };
      },
      siteUrl: "http://localhost:3000",
    });

    expect(hashes).toEqual([hashNfcToken(issued.rawToken)]);
    expect(hashes[0]).not.toBe(issued.rawToken);
    expect(issued.nfcUrl).toBe(`http://localhost:3000/t/${issued.rawToken}`);
    expect(issued.data).toEqual({ id: tagId });
  });

  it("rejects an invalid token before any database lookup", async () => {
    const source = dataSource();

    await expect(
      resolveNfcScan(source, userId, "too-short"),
    ).resolves.toBeNull();
    expect(source.findTagByHash).not.toHaveBeenCalled();
    expect(source.findBottle).not.toHaveBeenCalled();
  });

  it("resolves an active owned tag and its typical fill", async () => {
    await expect(
      resolveNfcScan(dataSource(), userId, validToken),
    ).resolves.toMatchObject({
      bottle: { id: bottleId },
      normalFillMl: 650,
      tag: { id: tagId },
    });
  });

  it("falls back to bottle capacity when typical fill is absent", async () => {
    await expect(
      resolveNfcScan(
        dataSource({
          bottle: { ...activeBottle, typicalFillMl: null },
        }),
        userId,
        validToken,
      ),
    ).resolves.toMatchObject({ normalFillMl: 710 });
  });

  it("makes another user's tag appear unavailable", async () => {
    const source = dataSource({
      tag: { ...activeTag, userId: "another-user" },
    });

    await expect(
      resolveNfcScan(source, userId, validToken),
    ).resolves.toBeNull();
    expect(source.findBottle).not.toHaveBeenCalled();
  });

  it("makes a revoked tag appear unavailable", async () => {
    await expect(
      resolveNfcScan(
        dataSource({ tag: { ...activeTag, status: "revoked" } }),
        userId,
        validToken,
      ),
    ).resolves.toBeNull();
  });

  it("makes an archived or non-primary bottle appear unavailable", async () => {
    await expect(
      resolveNfcScan(
        dataSource({
          bottle: {
            ...activeBottle,
            archivedAt: "2026-07-28T17:00:00.000Z",
          },
        }),
        userId,
        validToken,
      ),
    ).resolves.toBeNull();
    await expect(
      resolveNfcScan(
        dataSource({
          bottle: { ...activeBottle, isPrimary: false },
        }),
        userId,
        validToken,
      ),
    ).resolves.toBeNull();
  });

  it("uses a rotated hash immediately and leaves tag identity unchanged", async () => {
    const stored = new Map<string, ResolvedNfcTag>();
    stored.set(hashNfcToken(validToken), activeTag);
    const newToken = "B".repeat(43);
    stored.delete(hashNfcToken(validToken));
    stored.set(hashNfcToken(newToken), activeTag);
    const source = {
      findBottle: vi.fn(async () => activeBottle),
      findTagByHash: vi.fn(async (_owner: string, hash: string) => {
        return stored.get(hash) ?? null;
      }),
    } satisfies NfcScanDataSource;

    await expect(
      resolveNfcScan(source, userId, validToken),
    ).resolves.toBeNull();
    await expect(
      resolveNfcScan(source, userId, newToken),
    ).resolves.toMatchObject({ tag: { id: tagId } });
  });

  it("makes revoked credentials unavailable without deleting tag identity", async () => {
    const revoked = { ...activeTag, status: "revoked" };

    expect(revoked.id).toBe(tagId);
    await expect(
      resolveNfcScan(dataSource({ tag: revoked }), userId, validToken),
    ).resolves.toBeNull();
  });

  it("applies reassignment only to future scan resolution", async () => {
    const secondBottle = {
      ...activeBottle,
      id: "9e724dcf-acde-4fc7-adb0-8159b151de6c",
      name: "Gym bottle",
      typicalFillMl: 500,
    };
    const reassignedTag = { ...activeTag, bottleId: secondBottle.id };

    expect(activeTag.bottleId).toBe(bottleId);
    await expect(
      resolveNfcScan(
        dataSource({ bottle: secondBottle, tag: reassignedTag }),
        userId,
        validToken,
      ),
    ).resolves.toMatchObject({
      bottle: { id: secondBottle.id },
      normalFillMl: 500,
    });
  });
});
