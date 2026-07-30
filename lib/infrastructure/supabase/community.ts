import type { PostgrestError } from "@supabase/supabase-js";

import {
  communityDirectorySchema,
  communityMemberResultSchema,
  communityProfileSchema,
  communityUsernameAvailabilitySchema,
  type CommunityErrorCode,
  type CommunityMemberSummary,
  type CommunityProfile,
  type CommunityUsernameAvailability,
} from "@/lib/contracts/community";

import { createCommunityRpcClient } from "./community-rpc";

export class CommunityReadError extends Error {
  constructor(resource: "directory" | "member" | "profile") {
    super(`Unable to load Community ${resource}.`);
    this.name = "CommunityReadError";
  }
}

function logRpcError(operation: string, error: PostgrestError): void {
  console.error(`[HydroPOP] Community ${operation} failed.`, {
    code: error.code,
  });
}

export function toCommunityErrorCode(
  error: Pick<PostgrestError, "code" | "message">,
): CommunityErrorCode {
  const knownCodes: readonly CommunityErrorCode[] = [
    "USERNAME_INVALID",
    "USERNAME_RESERVED",
    "USERNAME_UNAVAILABLE",
    "VALIDATION_ERROR",
    "UNAUTHORIZED",
  ];
  const knownCode = knownCodes.find((code) => error.message.includes(code));

  return knownCode ?? "VALIDATION_ERROR";
}

export async function getMyCommunityProfile(): Promise<CommunityProfile | null> {
  const supabase = await createCommunityRpcClient();
  const { data, error } = await supabase.rpc("get_my_community_profile", {});

  if (error) {
    logRpcError("profile read", error);
    throw new CommunityReadError("profile");
  }

  if (data === null) {
    return null;
  }

  const parsed = communityProfileSchema.safeParse(data);

  if (!parsed.success) {
    console.error("[HydroPOP] Community profile response was invalid.");
    throw new CommunityReadError("profile");
  }

  return parsed.data;
}

export async function checkCommunityUsername(
  username: string,
): Promise<CommunityUsernameAvailability> {
  const supabase = await createCommunityRpcClient();
  const { data, error } = await supabase.rpc(
    "check_community_username_availability",
    { p_username: username },
  );

  if (error) {
    logRpcError("username check", error);
    throw error;
  }

  const parsed = communityUsernameAvailabilitySchema.safeParse(data);

  if (!parsed.success) {
    console.error("[HydroPOP] Community username response was invalid.");
    throw new CommunityReadError("profile");
  }

  return parsed.data;
}

export async function saveCommunityProfile(input: {
  isVisible: boolean;
  username: string;
}): Promise<CommunityProfile> {
  const supabase = await createCommunityRpcClient();
  const { data, error } = await supabase.rpc("save_community_profile", {
    p_is_visible: input.isVisible,
    p_username: input.username,
  });

  if (error) {
    logRpcError("profile save", error);
    throw error;
  }

  const parsed = communityProfileSchema.safeParse(data);

  if (!parsed.success) {
    console.error("[HydroPOP] Saved Community profile response was invalid.");
    throw new CommunityReadError("profile");
  }

  return parsed.data;
}

export async function listCommunityMembers(
  search: string | null = null,
): Promise<CommunityMemberSummary[]> {
  const supabase = await createCommunityRpcClient();
  const { data, error } = await supabase.rpc(
    "list_community_member_summaries",
    {
      p_limit: 50,
      p_search: search,
    },
  );

  if (error) {
    logRpcError("directory read", error);
    throw new CommunityReadError("directory");
  }

  const parsed = communityDirectorySchema.safeParse(data);

  if (!parsed.success) {
    console.error("[HydroPOP] Community directory response was invalid.");
    throw new CommunityReadError("directory");
  }

  return parsed.data;
}

export async function getCommunityMember(
  username: string,
): Promise<CommunityMemberSummary | null> {
  const supabase = await createCommunityRpcClient();
  const { data, error } = await supabase.rpc("get_community_member_summary", {
    p_username: username,
  });

  if (error) {
    logRpcError("member read", error);
    throw new CommunityReadError("member");
  }

  const parsed = communityMemberResultSchema.safeParse(data);

  if (!parsed.success) {
    console.error("[HydroPOP] Community member response was invalid.");
    throw new CommunityReadError("member");
  }

  return parsed.data;
}
