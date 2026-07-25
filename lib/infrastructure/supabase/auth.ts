import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import {
  isEmailAllowed,
  parseAllowedEmails,
} from "@/lib/application/auth/allowed-emails";

import { createClient } from "./server";

export type AllowedUser = User & { email: string };

export async function requireAllowedUser(): Promise<AllowedUser> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    redirect("/auth/login");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);
  const email = user?.email;

  if (
    userError ||
    !user ||
    user.id !== claims.sub ||
    !email ||
    !isEmailAllowed(email, allowedEmails)
  ) {
    redirect("/auth/login");
  }

  return { ...user, email };
}
