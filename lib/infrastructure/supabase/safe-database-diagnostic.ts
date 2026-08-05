import type { PostgrestError } from "@supabase/supabase-js";

type DatabaseErrorFields = Pick<
  PostgrestError,
  "code" | "details" | "hint" | "message"
>;

const sensitiveDiagnosticPattern =
  /https?:\/\/|\b(?:authorization|bearer|p256dh|vapid|worker[_ -]?secret)\b|[A-Za-z0-9_=-]{32,}/iu;

function sanitizeDiagnosticText(value: string | null): string | undefined {
  if (!value) return undefined;

  const normalized = value.replace(/\s+/gu, " ").trim().slice(0, 300);
  if (!normalized) return undefined;

  return sensitiveDiagnosticPattern.test(normalized)
    ? "[redacted]"
    : normalized;
}

export function safeDatabaseDiagnostic(
  operation: string,
  error: DatabaseErrorFields,
) {
  const details = sanitizeDiagnosticText(error.details);
  const hint = sanitizeDiagnosticText(error.hint);

  return {
    code: /^[0-9A-Z]{5}$/u.test(error.code) ? error.code : "UNKNOWN",
    message:
      sanitizeDiagnosticText(error.message) ?? "Database operation failed.",
    operation,
    ...(details ? { details } : {}),
    ...(hint ? { hint } : {}),
  };
}
