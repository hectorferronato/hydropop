"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login } from "@/app/auth/login/actions";
import { ActionSpinner } from "@/components/action-feedback";

import { initialLoginState } from "./state";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="login-submit bg-brand-primary hover:bg-brand-primary/90 focus-visible:outline-brand-primary mt-2 flex h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-bold text-white shadow-lg shadow-[rgba(62,41,255,0.2)] transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <ActionSpinner />
          Signing in…
        </span>
      ) : (
        "Sign in"
      )}
    </button>
  );
}

export function LoginForm({ destination }: { destination: string }) {
  const [state, formAction] = useActionState(login, initialLoginState);

  return (
    <form action={formAction} className="login-form mt-8 space-y-5">
      <input type="hidden" name="next" value={destination} />

      <div>
        <label
          htmlFor="email"
          className="text-brand-secondary/70 text-sm font-semibold"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          className="border-brand-secondary/10 text-brand-secondary placeholder:text-brand-secondary/25 focus:border-brand-primary focus:ring-brand-primary/10 mt-2 h-12 w-full rounded-2xl border bg-white px-4 text-base transition outline-none focus:ring-4"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-brand-secondary/70 text-sm font-semibold"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border-brand-secondary/10 text-brand-secondary placeholder:text-brand-secondary/25 focus:border-brand-primary focus:ring-brand-primary/10 mt-2 h-12 w-full rounded-2xl border bg-white px-4 text-base transition outline-none focus:ring-4"
          placeholder="Your password"
        />
      </div>

      {state.message ? (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
