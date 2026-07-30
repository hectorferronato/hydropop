"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { ActionSpinner } from "@/components/action-feedback";
import {
  normalizeCommunityUsername,
  validateCommunityUsername,
} from "@/lib/domain/community/username";

import { checkUsernameAvailability, joinCommunity } from "./actions";
import {
  initialCommunityActionState,
  type UsernameAvailabilityState,
} from "./state";

function JoinButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand-primary hover:bg-brand-primary/90 focus-visible:outline-brand-primary flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-65"
    >
      {pending ? (
        <>
          <ActionSpinner />
          Joining…
        </>
      ) : (
        "Join community"
      )}
    </button>
  );
}

export function CommunityJoinForm({
  profileOrigin,
  suggestedUsername,
}: {
  profileOrigin: string;
  suggestedUsername: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    joinCommunity,
    initialCommunityActionState,
  );
  const [username, setUsername] = useState(suggestedUsername);
  const [availability, setAvailability] =
    useState<UsernameAvailabilityState | null>(null);
  const [isChecking, startChecking] = useTransition();
  const normalized = normalizeCommunityUsername(username);
  const validation = validateCommunityUsername(username);
  const currentAvailability =
    availability?.username === normalized ? availability : null;

  useEffect(() => {
    if (validation.error) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      startChecking(async () => {
        const result = await checkUsernameAvailability(username);

        if (active) {
          setAvailability(result);
        }
      });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [username, validation.error]);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    const timer = window.setTimeout(() => router.refresh(), 650);
    return () => window.clearTimeout(timer);
  }, [router, state.status]);

  return (
    <form action={formAction} className="mt-6">
      <label
        htmlFor="community-username"
        className="text-brand-secondary text-sm font-bold"
      >
        Username
      </label>
      <input
        id="community-username"
        name="username"
        type="text"
        autoCapitalize="none"
        autoComplete="username"
        spellCheck={false}
        minLength={3}
        maxLength={30}
        required
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        className="border-brand-secondary/10 focus:border-brand-primary focus:ring-brand-primary/15 text-brand-secondary mt-2 h-12 w-full rounded-2xl border bg-white px-4 text-sm font-semibold transition outline-none focus:ring-4"
        aria-describedby="community-username-help community-username-status"
      />
      <p
        id="community-username-help"
        className="text-brand-secondary/45 mt-2 text-xs leading-5"
      >
        Use lowercase letters or numbers, with single dots, underscores, or
        hyphens between segments.
      </p>

      <div className="bg-brand-background mt-4 min-w-0 rounded-2xl p-4">
        <p className="text-brand-secondary/40 text-[0.65rem] font-bold uppercase">
          Your member profile
        </p>
        <p className="text-brand-primary mt-1 text-sm font-semibold break-all">
          {profileOrigin}/u/{normalized || "your.username"}
        </p>
      </div>

      <p
        id="community-username-status"
        aria-live="polite"
        className={`mt-3 min-h-5 text-xs font-semibold ${
          currentAvailability?.available
            ? "text-emerald-700"
            : "text-brand-secondary/50"
        }`}
      >
        {validation.error === "USERNAME_RESERVED"
          ? "That username is reserved by HydroPOP."
          : validation.error
            ? "Enter a valid 3–30 character username."
            : isChecking
              ? "Checking availability…"
              : currentAvailability?.available
                ? `@${currentAvailability.username} is available.`
                : currentAvailability?.errorCode === "VALIDATION_ERROR"
                  ? "Availability could not be checked. Try again."
                  : currentAvailability
                    ? "That username is unavailable."
                    : "Availability will appear here."}
      </p>

      <label className="border-brand-secondary/8 mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4">
        <input
          type="checkbox"
          name="consent"
          value="confirmed"
          required
          className="accent-brand-primary mt-0.5 size-4 shrink-0"
        />
        <span className="text-brand-secondary/65 text-sm leading-6">
          Other signed-in HydroPOP members will be able to see your display name
          and hydration summary.
        </span>
      </label>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
            state.status === "error"
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {state.status === "success" ? "Joined ✓" : state.message}
        </p>
      ) : null}

      <div className="mt-5">
        <JoinButton />
      </div>
    </form>
  );
}
