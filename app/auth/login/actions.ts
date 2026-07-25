"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  isEmailAllowed,
  parseAllowedEmails,
} from "@/lib/application/auth/allowed-emails";
import {
  createUnauthorizedPath,
  sanitizeLoginDestination,
} from "@/lib/application/auth/login-destination";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";

import type { LoginState } from "./state";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  next: z.string(),
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
    next: formData.get("next"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    return { message: genericLoginError };
  }

  const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);
  const destination = sanitizeLoginDestination(credentials.data.next);

  if (!isEmailAllowed(credentials.data.email, allowedEmails)) {
    redirect(createUnauthorizedPath(destination));
  }

  let onboardingComplete = false;
  let authenticatedEmailIsAllowed = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.data.email,
      password: credentials.data.password,
    });

    if (error || !data.user) {
      return { message: genericLoginError };
    }

    authenticatedEmailIsAllowed = isEmailAllowed(
      data.user.email,
      allowedEmails,
    );

    if (!authenticatedEmailIsAllowed) {
      await supabase.auth.signOut();
    } else {
      const onboarding = await getOnboardingSnapshot(supabase, data.user.id);
      onboardingComplete = onboarding.isComplete;
    }
  } catch {
    return { message: genericLoginError };
  }

  if (!authenticatedEmailIsAllowed) {
    redirect(createUnauthorizedPath(destination));
  }

  revalidatePath("/", "layout");

  if (!onboardingComplete && destination !== "/setup") {
    const parameters = new URLSearchParams({ next: destination });
    redirect(`/setup?${parameters.toString()}` as Route);
  }

  redirect(destination);
}
