import { describe, expect, it } from "vitest";

import {
  normalizeCommunityUsername,
  suggestCommunityUsername,
  validateCommunityUsername,
} from "@/lib/domain/community/username";

describe("Community username", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeCommunityUsername("  Hector.Ferronato  ")).toBe(
      "hector.ferronato",
    );
  });

  it.each(["hector.ferronato", "beatriz", "bea_1", "lais-zamper", "abc"])(
    "accepts %s",
    (username) => {
      expect(validateCommunityUsername(username)).toEqual({
        error: null,
        username,
      });
    },
  );

  it.each([
    ".hector",
    "hector.",
    "hector..ferronato",
    "Hector Ferronato",
    "bea@home",
    "ab",
    "a".repeat(31),
    "bea_-home",
  ])("rejects invalid username %s", (username) => {
    expect(validateCommunityUsername(username).error).toBe("USERNAME_INVALID");
  });

  it.each([
    "auth",
    "api",
    "community",
    "settings",
    "support",
    "hydropop",
    "system",
  ])("rejects reserved username %s", (username) => {
    expect(validateCommunityUsername(username).error).toBe("USERNAME_RESERVED");
  });

  it("suggests a visible normalized username without random suffixes", () => {
    expect(suggestCommunityUsername("Hector Ferronato")).toBe(
      "hector.ferronato",
    );
    expect(suggestCommunityUsername("Beatriz Teixeira")).toBe(
      "beatriz.teixeira",
    );
    expect(suggestCommunityUsername("Laís Zamper")).toBe("lais.zamper");
  });
});
