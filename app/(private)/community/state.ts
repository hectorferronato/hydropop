import type { CommunityErrorCode } from "@/lib/contracts/community";

export type CommunityActionState = {
  errorCode: CommunityErrorCode | null;
  message: string | null;
  status: "idle" | "error" | "success";
};

export const initialCommunityActionState: CommunityActionState = {
  errorCode: null,
  message: null,
  status: "idle",
};

export type UsernameAvailabilityState = {
  available: boolean;
  errorCode:
    | "USERNAME_INVALID"
    | "USERNAME_RESERVED"
    | "USERNAME_UNAVAILABLE"
    | "VALIDATION_ERROR"
    | null;
  username: string;
};
