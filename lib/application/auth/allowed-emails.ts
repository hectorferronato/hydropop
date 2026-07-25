import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export function parseAllowedEmails(
  rawAllowedEmails: string | undefined,
): ReadonlySet<string> {
  if (!rawAllowedEmails?.trim()) {
    return new Set();
  }

  const parsed = z.array(emailSchema).safeParse(rawAllowedEmails.split(","));

  if (!parsed.success) {
    return new Set();
  }

  return new Set(parsed.data);
}

export function isEmailAllowed(
  email: string | null | undefined,
  allowedEmails: ReadonlySet<string>,
): boolean {
  if (!email) {
    return false;
  }

  const parsedEmail = emailSchema.safeParse(email);

  return parsedEmail.success && allowedEmails.has(parsedEmail.data);
}
