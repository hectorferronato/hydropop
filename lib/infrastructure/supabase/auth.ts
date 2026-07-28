import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import {
  isEmailAllowed,
  parseAllowedEmails,
} from "@/lib/application/auth/allowed-emails";
import {
  createLoginPath,
  createUnauthorizedPath,
  sanitizeLoginDestination,
} from "@/lib/application/auth/login-destination";

import { createClient } from "./server";

export type AllowedUser = User & { email: string };

export type AllowedUserResult =
  | { status: "allowed"; user: AllowedUser }
  | { status: "forbidden" | "unauthenticated"; user: null };

export async function getAllowedUser(): Promise<AllowedUserResult> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    return { status: "unauthenticated", user: null };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);
  const email = user?.email;

  if (userError || !user || user.id !== claims.sub || !email) {
    return { status: "unauthenticated", user: null };
  }

  if (!isEmailAllowed(email, allowedEmails)) {
    return { status: "forbidden", user: null };
  }

  return { status: "allowed", user: { ...user, email } };
}

export async function requireAllowedUser(
  destination = "/today",
): Promise<AllowedUser> {
  const safeDestination = sanitizeLoginDestination(destination);
  const result = await getAllowedUser();

  if (result.status === "allowed") {
    return result.user;
  }

  if (result.status === "unauthenticated") {
    redirect(createLoginPath(safeDestination));
  }

  redirect(createUnauthorizedPath(safeDestination));
}
