"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { ActionSpinner } from "@/components/action-feedback";
import { normalizeCommunityUsername } from "@/lib/domain/community/username";

import { saveCommunitySettings } from "../../community/actions";
import { initialCommunityActionState } from "../../community/state";

function SettingsButtons() {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="submit"
        disabled={pending}
        className="bg-brand-primary flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-65"
      >
        {pending ? (
          <>
            <ActionSpinner />
            Saving…
          </>
        ) : (
          "Save community settings"
        )}
      </button>
      <button
        type="submit"
        name="intent"
        value="hide"
        disabled={pending}
        className="border-brand-secondary/10 text-brand-secondary h-12 rounded-2xl border bg-white px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-65"
      >
        Leave / hide from Community
      </button>
    </div>
  );
}

export function CommunitySettingsForm({
  initialIsVisible,
  initialUsername,
  profileUrl,
}: {
  initialIsVisible: boolean;
  initialUsername: string;
  profileUrl: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    saveCommunitySettings,
    initialCommunityActionState,
  );
  const [username, setUsername] = useState(initialUsername);
  const [copied, setCopied] = useState(false);
  const normalizedUsername = normalizeCommunityUsername(username);
  const currentProfileUrl = `${profileUrl.slice(
    0,
    profileUrl.lastIndexOf("/") + 1,
  )}${encodeURIComponent(normalizedUsername || initialUsername)}`;

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    const timer = window.setTimeout(() => router.refresh(), 700);
    return () => window.clearTimeout(timer);
  }, [router, state.status]);

  async function copyProfileUrl() {
    try {
      await navigator.clipboard.writeText(currentProfileUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={formAction} className="mt-7 space-y-6">
      <div>
        <label
          htmlFor="community-settings-username"
          className="text-brand-secondary text-sm font-bold"
        >
          Username
        </label>
        <input
          id="community-settings-username"
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          minLength={3}
          maxLength={30}
          required
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          className="border-brand-secondary/10 focus:border-brand-primary focus:ring-brand-primary/15 text-brand-secondary mt-2 h-12 w-full rounded-2xl border bg-white px-4 text-sm font-semibold transition outline-none focus:ring-4"
        />
        <p className="text-brand-secondary/45 mt-2 text-xs leading-5">
          Previous usernames remain reserved and their old profile URLs stay
          unavailable.
        </p>
      </div>

      <div className="bg-brand-background rounded-2xl p-4">
        <p className="text-brand-secondary/40 text-[0.65rem] font-bold uppercase">
          Member profile URL
        </p>
        <p className="text-brand-primary mt-1 text-sm font-semibold break-all">
          {currentProfileUrl}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyProfileUrl}
            className="border-brand-primary/15 text-brand-primary h-10 rounded-xl border bg-white px-3 text-xs font-bold"
          >
            {copied ? "Copied ✓" : "Copy profile URL"}
          </button>
          <Link
            href={`/u/${normalizedUsername || initialUsername}` as Route}
            className="border-brand-primary/15 text-brand-primary inline-flex h-10 items-center rounded-xl border bg-white px-3 text-xs font-bold"
          >
            Preview profile
          </Link>
        </div>
      </div>

      <label className="border-brand-secondary/8 flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4">
        <input
          type="checkbox"
          name="isVisible"
          defaultChecked={initialIsVisible}
          className="accent-brand-primary mt-0.5 size-4 shrink-0"
        />
        <span>
          <span className="text-brand-secondary block text-sm font-bold">
            Visible in Community
          </span>
          <span className="text-brand-secondary/50 mt-1 block text-xs leading-5">
            Signed-in HydroPOP members can find your profile and view your
            limited hydration summary.
          </span>
        </span>
      </label>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            state.status === "error"
              ? "border border-red-200 bg-red-50 text-red-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <SettingsButtons />
    </form>
  );
}
