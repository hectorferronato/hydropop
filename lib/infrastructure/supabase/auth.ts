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

export async function requireAllowedUser(
  destination = "/today",
): Promise<AllowedUser> {
  const safeDestination = sanitizeLoginDestination(destination);
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    redirect(createLoginPath(safeDestination));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);
  const email = user?.email;

  if (userError || !user || user.id !== claims.sub || !email) {
    redirect(createLoginPath(safeDestination));
  }

  if (!isEmailAllowed(email, allowedEmails)) {
    redirect(createUnauthorizedPath(safeDestination));
  }

  return { ...user, email };
}
