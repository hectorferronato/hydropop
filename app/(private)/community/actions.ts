"use server";

import { revalidatePath } from "next/cache";

import { communityProfileInputSchema } from "@/lib/contracts/community";
import { validateCommunityUsername } from "@/lib/domain/community/username";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import {
  checkCommunityUsername,
  getMyCommunityProfile,
  saveCommunityProfile,
  toCommunityErrorCode,
} from "@/lib/infrastructure/supabase/community";

import type { CommunityActionState, UsernameAvailabilityState } from "./state";

function messageForError(
  code:
    | "USERNAME_INVALID"
    | "USERNAME_RESERVED"
    | "USERNAME_UNAVAILABLE"
    | "VALIDATION_ERROR",
): string {
  switch (code) {
    case "USERNAME_INVALID":
      return "Use 3–30 lowercase letters or numbers, with single dots, underscores, or hyphens between segments.";
    case "USERNAME_RESERVED":
      return "That username is reserved by HydroPOP. Choose another.";
    case "USERNAME_UNAVAILABLE":
      return "That username is unavailable. Choose another.";
    default:
      return "We couldn’t save your Community settings. Nothing was changed.";
  }
}

function revalidateCommunityProfilePaths(
  previousUsername: string | null,
  currentUsername: string,
): void {
  revalidatePath("/community");
  revalidatePath("/profile");
  revalidatePath("/settings/community");
  revalidatePath(`/u/${currentUsername}`);

  if (previousUsername && previousUsername !== currentUsername) {
    revalidatePath(`/u/${previousUsername}`);
  }
}

export async function checkUsernameAvailability(
  rawUsername: string,
): Promise<UsernameAvailabilityState> {
  await requireAllowedUser("/community");

  const validation = validateCommunityUsername(rawUsername);

  if (validation.error || !validation.username) {
    return {
      available: false,
      errorCode: validation.error,
      username: rawUsername.trim().toLowerCase(),
    };
  }

  try {
    const availability = await checkCommunityUsername(validation.username);

    return {
      available: availability.available,
      errorCode: availability.errorCode,
      username: availability.username,
    };
  } catch {
    return {
      available: false,
      errorCode: "VALIDATION_ERROR",
      username: validation.username,
    };
  }
}

export async function joinCommunity(
  _previousState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  await requireAllowedUser("/community");

  if (formData.get("consent") !== "confirmed") {
    return {
      errorCode: "VALIDATION_ERROR",
      message: "Confirm the limited profile visibility before joining.",
      status: "error",
    };
  }

  const validation = validateCommunityUsername(
    String(formData.get("username") ?? ""),
  );

  if (validation.error || !validation.username) {
    const code = validation.error ?? "USERNAME_INVALID";
    return {
      errorCode: code,
      message: messageForError(code),
      status: "error",
    };
  }

  try {
    const existing = await getMyCommunityProfile();
    const profile = await saveCommunityProfile({
      isVisible: true,
      username: validation.username,
    });

    revalidateCommunityProfilePaths(
      existing?.username ?? null,
      profile.username,
    );

    return {
      errorCode: null,
      message: "You joined the HydroPOP Community.",
      status: "success",
    };
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      "message" in error &&
      typeof error.code === "string" &&
      typeof error.message === "string"
        ? toCommunityErrorCode({
            code: error.code,
            message: error.message,
          })
        : "VALIDATION_ERROR";
    const displayCode =
      code === "USERNAME_INVALID" ||
      code === "USERNAME_RESERVED" ||
      code === "USERNAME_UNAVAILABLE"
        ? code
        : "VALIDATION_ERROR";

    return {
      errorCode: code,
      message: messageForError(displayCode),
      status: "error",
    };
  }
}

export async function saveCommunitySettings(
  _previousState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  await requireAllowedUser("/settings/community");

  const current = await getMyCommunityProfile();

  if (!current) {
    return {
      errorCode: "COMMUNITY_PROFILE_NOT_FOUND",
      message: "Join Community before changing these settings.",
      status: "error",
    };
  }

  const parsed = communityProfileInputSchema.safeParse({
    isVisible:
      formData.get("intent") === "hide"
        ? false
        : formData.get("isVisible") === "on",
    username: String(formData.get("username") ?? ""),
  });

  if (!parsed.success) {
    const validation = validateCommunityUsername(
      String(formData.get("username") ?? ""),
    );
    const code = validation.error ?? "VALIDATION_ERROR";

    return {
      errorCode: code,
      message: messageForError(code),
      status: "error",
    };
  }

  try {
    const profile = await saveCommunityProfile(parsed.data);
    revalidateCommunityProfilePaths(current.username, profile.username);

    return {
      errorCode: null,
      message: profile.isVisible
        ? "Community settings saved."
        : "Your Community profile is now hidden.",
      status: "success",
    };
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      "message" in error &&
      typeof error.code === "string" &&
      typeof error.message === "string"
        ? toCommunityErrorCode({
            code: error.code,
            message: error.message,
          })
        : "VALIDATION_ERROR";
    const displayCode =
      code === "USERNAME_INVALID" ||
      code === "USERNAME_RESERVED" ||
      code === "USERNAME_UNAVAILABLE"
        ? code
        : "VALIDATION_ERROR";

    return {
      errorCode: code,
      message: messageForError(displayCode),
      status: "error",
    };
  }
}
