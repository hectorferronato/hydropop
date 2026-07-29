"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { ActionSpinner } from "./action-feedback";

export function FormSubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: ReactNode;
  className: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <ActionSpinner />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
