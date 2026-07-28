import { isValidPublicNfcToken } from "@/lib/contracts/nfc-token";

import { hashNfcToken } from "./token-security";

export type ResolvedNfcBottle = {
  archivedAt: string | null;
  brand: string | null;
  capacityMl: number;
  id: string;
  isPrimary: boolean;
  model: string | null;
  name: string;
  typicalFillMl: number | null;
  userId: string;
};

export type ResolvedNfcTag = {
  bottleId: string;
  id: string;
  label: string | null;
  lastConfirmedAt: string | null;
  status: string;
  userId: string;
};

export type NfcScanResolution = {
  bottle: ResolvedNfcBottle;
  normalFillMl: number;
  tag: ResolvedNfcTag;
};

export type NfcScanDataSource = {
  findBottle(
    userId: string,
    bottleId: string,
  ): Promise<ResolvedNfcBottle | null>;
  findTagByHash(
    userId: string,
    tokenHash: string,
  ): Promise<ResolvedNfcTag | null>;
};

export async function resolveNfcScan(
  dataSource: NfcScanDataSource,
  userId: string,
  token: string,
): Promise<NfcScanResolution | null> {
  if (!isValidPublicNfcToken(token)) {
    return null;
  }

  const tag = await dataSource.findTagByHash(userId, hashNfcToken(token));

  if (!tag || tag.userId !== userId || tag.status !== "active") {
    return null;
  }

  const bottle = await dataSource.findBottle(userId, tag.bottleId);

  if (
    !bottle ||
    bottle.userId !== userId ||
    bottle.archivedAt !== null ||
    !bottle.isPrimary
  ) {
    return null;
  }

  return {
    bottle,
    normalFillMl: bottle.typicalFillMl ?? bottle.capacityMl,
    tag,
  };
}
