"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  isEmailAllowed,
  parseAllowedEmails,
} from "@/lib/application/auth/allowed-emails";
import { createClient } from "@/lib/infrastructure/supabase/server";

import type { LoginState } from "./state";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(1_024),
});

const genericLoginError =
  "Unable to sign in. Check your credentials or contact your administrator.";

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const credentials = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    return { message: genericLoginError };
  }

  const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);

  if (!isEmailAllowed(credentials.data.email, allowedEmails)) {
    return { message: genericLoginError };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(credentials.data);

    if (error) {
      return { message: genericLoginError };
    }
  } catch {
    return { message: genericLoginError };
  }

  revalidatePath("/", "layout");
  redirect("/today");
}
