"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { buildNfcUrl } from "@/lib/application/urls/site-url";
import type { ApiResponse } from "@/lib/contracts/api-response";
import { validateNfcFriendlyCode } from "@/lib/contracts/nfc-friendly-code";
import type {
  IssuedNfcCredential,
  NfcTagList,
  NfcTagSummary,
} from "@/lib/contracts/nfc";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

const inputClassName =
  "mt-2 h-12 w-full rounded-2xl border border-brand-secondary/10 bg-white px-4 text-sm text-brand-secondary outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10";

type FriendlyAvailability = {
  available: boolean;
  code: string | null;
  message: string;
};

async function readApiResponse<Data>(
  response: Response,
): Promise<ApiResponse<Data>> {
  return (await response.json()) as ApiResponse<Data>;
}

function formatLastUse(value: string | null, timezone: string): string {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(new Date(value))
    : "Never";
}

function friendlyAvailability(
  value: string,
  list: NfcTagList,
  currentTag: NfcTagSummary | null = null,
): FriendlyAvailability {
  if (!value.trim()) {
    return {
      available: true,
      code: null,
      message: "Optional. You can add one later.",
    };
  }

  const validation = validateNfcFriendlyCode(value);

  if (validation.error) {
    return {
      available: false,
      code: null,
      message: validation.error,
    };
  }

  if (validation.code === currentTag?.friendlyCode) {
    return {
      available: true,
      code: validation.code,
      message: "This is the tag’s current friendly code.",
    };
  }

  if (
    list.friendlyCodeReservations.some(
      (reservation) => reservation.code === validation.code,
    )
  ) {
    return {
      available: false,
      code: validation.code,
      message: "Unavailable for your account. Choose another code.",
    };
  }

  return {
    available: true,
    code: validation.code,
    message: "Available for your account.",
  };
}

function CopyUrlButton({ label, url }: { label: string; url: string }) {
  const [state, setState] = useState<"copied" | "error" | "idle">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  async function copy() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("error");
    }

    timerRef.current = setTimeout(() => setState("idle"), 2_000);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void copy()}
        className="border-brand-primary/20 text-brand-primary h-11 rounded-xl border bg-white px-4 text-xs font-bold"
      >
        {state === "copied" ? "✓ Copied!" : label}
      </button>
      <span aria-live="polite" className="mt-1 block min-h-4 text-xs">
        {state === "copied"
          ? "URL copied to clipboard."
          : state === "error"
            ? "Could not copy. Select and copy the URL manually."
            : ""}
      </span>
    </div>
  );
}

function BottleAmounts({
  bottle,
  unit,
}: {
  bottle: NfcTagSummary["bottle"];
  unit: VolumeUnit;
}) {
  return (
    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
      <div className="bg-brand-bg rounded-xl p-3">
        <dt className="text-brand-secondary/45 text-xs">Bottle capacity</dt>
        <dd className="text-brand-secondary mt-1 font-bold">
          {formatDisplayVolume(bottle.capacityMl, unit)} {unit}
        </dd>
      </div>
      <div className="bg-brand-bg rounded-xl p-3">
        <dt className="text-brand-secondary/45 text-xs">
          Records per completion
        </dt>
        <dd className="text-brand-secondary mt-1 font-bold">
          {formatDisplayVolume(bottle.normalFillMl, unit)} {unit}
          {bottle.typicalFillMl === null ? " — uses full capacity" : ""}
        </dd>
      </div>
    </dl>
  );
}

export function NfcManager({
  initialList,
  siteUrl,
  timezone,
  unit,
}: {
  initialList: NfcTagList;
  siteUrl: string;
  timezone: string;
  unit: VolumeUnit;
}) {
  const [list, setList] = useState(initialList);
  const [credential, setCredential] = useState<IssuedNfcCredential | null>(
    null,
  );
  const [credentialKind, setCredentialKind] = useState<"created" | "rotated">(
    "created",
  );
  const [creationComplete, setCreationComplete] = useState(false);
  const [createCode, setCreateCode] = useState("");
  const [editCodes, setEditCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialList.tags.map((tag) => [tag.id, tag.friendlyCode ?? ""]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const createFormRef = useRef<HTMLFormElement>(null);
  const createSubmissionLockedRef = useRef(false);
  const resultRef = useRef<HTMLElement>(null);
  const createAvailability = useMemo(
    () => friendlyAvailability(createCode, list),
    [createCode, list],
  );

  useEffect(() => {
    if (!credential) {
      return;
    }

    resultRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    resultRef.current?.focus({ preventScroll: true });
  }, [credential]);

  function replaceTag(tag: NfcTagSummary) {
    setList((current) => ({
      ...current,
      friendlyCodeReservations:
        tag.friendlyCode &&
        !current.friendlyCodeReservations.some(
          (reservation) => reservation.code === tag.friendlyCode,
        )
          ? [
              ...current.friendlyCodeReservations,
              { code: tag.friendlyCode, tagId: tag.id },
            ]
          : current.friendlyCodeReservations,
      tags: current.tags.map((item) => (item.id === tag.id ? tag : item)),
    }));
    setEditCodes((current) => ({
      ...current,
      [tag.id]: tag.friendlyCode ?? "",
    }));
  }

  async function createTag(formData: FormData) {
    if (
      createSubmissionLockedRef.current ||
      pending !== null ||
      creationComplete ||
      !createAvailability.available
    ) {
      return;
    }

    createSubmissionLockedRef.current = true;
    setCredential(null);
    setMessage(null);
    setPending("create");

    try {
      const response = await fetch("/api/v1/nfc-tags", {
        body: JSON.stringify({
          bottleId: formData.get("bottleId"),
          friendlyCode: formData.get("friendlyCode"),
          label: formData.get("label"),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await readApiResponse<IssuedNfcCredential>(response);

      if (payload.error) {
        createSubmissionLockedRef.current = false;
        setMessage(payload.error.message);
        return;
      }

      setList((current) => ({
        ...current,
        friendlyCodeReservations: payload.data.tag.friendlyCode
          ? [
              ...current.friendlyCodeReservations,
              {
                code: payload.data.tag.friendlyCode,
                tagId: payload.data.tag.id,
              },
            ]
          : current.friendlyCodeReservations,
        tags: [payload.data.tag, ...current.tags],
      }));
      setEditCodes((current) => ({
        ...current,
        [payload.data.tag.id]: payload.data.tag.friendlyCode ?? "",
      }));
      setCredentialKind("created");
      setCredential(payload.data);
      setCreationComplete(true);
    } catch {
      createSubmissionLockedRef.current = false;
      setMessage("HydroPOP could not create the NFC tag.");
    } finally {
      setPending(null);
    }
  }

  function createAnotherTag() {
    createSubmissionLockedRef.current = false;
    setCredential(null);
    setCreationComplete(false);
    setCreateCode("");
    setMessage(null);
    createFormRef.current?.reset();
  }

  async function rotateTag(tagId: string) {
    if (pending !== null) {
      return;
    }

    setCredential(null);
    setMessage(null);
    setPending(`rotate:${tagId}`);

    try {
      const response = await fetch(`/api/v1/nfc-tags/${tagId}/rotate`, {
        method: "POST",
      });
      const payload = await readApiResponse<IssuedNfcCredential>(response);

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      replaceTag(payload.data.tag);
      setCredentialKind("rotated");
      setCredential(payload.data);
    } catch {
      setMessage("HydroPOP could not rotate this secure NFC URL.");
    } finally {
      setPending(null);
    }
  }

  async function revokeTag(tagId: string) {
    if (pending !== null) {
      return;
    }

    setCredential(null);
    setMessage(null);
    setPending(`revoke:${tagId}`);

    try {
      const response = await fetch(`/api/v1/nfc-tags/${tagId}/revoke`, {
        method: "POST",
      });
      const payload = await readApiResponse<NfcTagSummary>(response);

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      replaceTag(payload.data);
      setMessage(
        "Tag revoked. Its friendly and secure URLs stopped working without deleting hydration history.",
      );
    } catch {
      setMessage("HydroPOP could not revoke this NFC tag.");
    } finally {
      setPending(null);
    }
  }

  async function updateTag(tag: NfcTagSummary, formData: FormData) {
    const availability = friendlyAvailability(
      String(formData.get("friendlyCode") ?? ""),
      list,
      tag,
    );

    if (pending !== null || !availability.available) {
      return;
    }

    setCredential(null);
    setMessage(null);
    setPending(`update:${tag.id}`);

    try {
      const response = await fetch(`/api/v1/nfc-tags/${tag.id}`, {
        body: JSON.stringify({
          bottleId: formData.get("bottleId"),
          friendlyCode: formData.get("friendlyCode"),
          label: formData.get("label"),
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      const payload = await readApiResponse<NfcTagSummary>(response);

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      replaceTag(payload.data);
      setMessage(
        "Tag saved. The previous friendly URL is invalid, the secure URL is unchanged, and historical hydration events were not modified.",
      );
    } catch {
      setMessage("HydroPOP could not update this NFC tag.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-8 grid gap-6">
      <section className="border-brand-secondary/5 rounded-[2rem] border bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-7">
        <h2 className="text-brand-secondary text-xl font-bold">Create a tag</h2>
        <p className="text-brand-secondary/50 mt-2 text-sm leading-6">
          Friendly pilot codes are convenient locators, not credentials.
          Authentication and bottle ownership are always required.
        </p>

        {list.assignableBottles.length > 0 ? (
          <form
            ref={createFormRef}
            action={createTag}
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
            <label className="text-brand-secondary/70 text-sm font-semibold">
              Active bottle
              <select name="bottleId" required className={inputClassName}>
                {list.assignableBottles.map((bottle) => (
                  <option key={bottle.id} value={bottle.id}>
                    {bottle.name} · capacity{" "}
                    {formatDisplayVolume(bottle.capacityMl, unit)} {unit} ·
                    records {formatDisplayVolume(bottle.normalFillMl, unit)}{" "}
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-brand-secondary/70 text-sm font-semibold">
              Tag label <span className="font-normal opacity-50">optional</span>
              <input
                name="label"
                maxLength={80}
                placeholder="Kitchen tag"
                className={inputClassName}
              />
            </label>
            <label className="text-brand-secondary/70 text-sm font-semibold sm:col-span-2">
              Friendly pilot code{" "}
              <span className="font-normal opacity-50">optional</span>
              <input
                name="friendlyCode"
                value={createCode}
                onChange={(event) => setCreateCode(event.target.value)}
                maxLength={32}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="bea-kitchen"
                className={inputClassName}
              />
              <span
                className={`mt-2 block text-xs ${
                  createAvailability.available
                    ? "text-emerald-700"
                    : "text-red-700"
                }`}
              >
                {createAvailability.message}
              </span>
            </label>
            {createAvailability.code ? (
              <div className="border-brand-primary/15 bg-brand-primary/5 rounded-2xl border p-4 sm:col-span-2">
                <p className="text-brand-secondary/45 text-xs font-bold uppercase">
                  Recommended pilot URL preview
                </p>
                <p className="text-brand-primary mt-2 font-mono text-xs break-all">
                  {buildNfcUrl(siteUrl, createAvailability.code)}
                </p>
              </div>
            ) : null}
            {creationComplete ? (
              <button
                type="button"
                onClick={createAnotherTag}
                className="border-brand-primary/20 text-brand-primary h-12 rounded-2xl border bg-white px-5 text-sm font-bold sm:col-span-2"
              >
                Create another tag
              </button>
            ) : (
              <button
                type="submit"
                disabled={pending !== null || !createAvailability.available}
                className="bg-brand-primary hover:bg-brand-primary/90 h-12 rounded-2xl px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 sm:col-span-2"
              >
                {pending === "create" ? "Creating…" : "Create NFC tag"}
              </button>
            )}
          </form>
        ) : (
          <div className="mt-5 rounded-2xl bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              An active primary bottle is required before creating a tag.
            </p>
            <Link
              href="/settings"
              className="mt-3 inline-block text-sm font-bold text-amber-800 underline"
            >
              Review bottle settings
            </Link>
          </div>
        )}
      </section>

      {credential ? (
        <section
          ref={resultRef as RefObject<HTMLElement>}
          tabIndex={-1}
          role="status"
          className="rounded-[2rem] border-2 border-emerald-300 bg-emerald-50 p-5 shadow-[0_24px_80px_rgba(5,150,105,0.16)] outline-none sm:p-7"
        >
          <p className="text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">
            Success
          </p>
          <h2 className="text-brand-secondary mt-2 text-2xl font-bold">
            {credentialKind === "created"
              ? "NFC tag created"
              : "Secure URL rotated"}
          </h2>
          <BottleAmounts bottle={credential.tag.bottle} unit={unit} />

          {credential.friendlyUrl ? (
            <div className="border-brand-primary/20 bg-brand-primary/5 mt-5 rounded-2xl border p-4">
              <p className="text-brand-primary text-xs font-bold uppercase">
                Recommended pilot URL
              </p>
              <p className="text-brand-secondary mt-2 font-mono text-xs break-all">
                {credential.friendlyUrl}
              </p>
              <div className="mt-3">
                <CopyUrlButton
                  label="Copy friendly URL"
                  url={credential.friendlyUrl}
                />
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-white p-4 text-sm text-emerald-950/70">
              Add a friendly pilot code to make the tag URL easier to type.
            </p>
          )}

          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-xs font-bold text-amber-900 uppercase">
              Advanced secure URL · displayed once
            </p>
            <p className="mt-2 font-mono text-xs break-all text-amber-950">
              {credential.secureUrl}
            </p>
            <p className="mt-3 text-sm font-bold text-amber-950">
              Copy the secure URL now. It cannot be shown again.
            </p>
            <div className="mt-3">
              <CopyUrlButton
                label="Copy secure URL"
                url={credential.secureUrl}
              />
            </div>
          </div>

          <h3 className="text-brand-secondary mt-7 text-sm font-bold">
            Write a URL to the physical tag
          </h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-emerald-950/70">
            <li>Copy the recommended friendly or advanced secure URL.</li>
            <li>Open an NFC-writing app on your phone.</li>
            <li>Choose a URL/URI record.</li>
            <li>Paste the complete HydroPOP URL.</li>
            <li>Write it to the NFC tag.</li>
            <li>Test the tag before considering any lock operation.</li>
          </ol>
          <p className="mt-4 text-xs leading-5 text-emerald-900/60">
            NFC Tools or an equivalent app can be used. Do not lock the tag
            during early validation.
          </p>
        </section>
      ) : null}

      {message ? (
        <p
          role="status"
          className="border-brand-secondary/5 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold"
        >
          {message}
        </p>
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-brand-secondary text-xl font-bold">
          Your NFC tags
        </h2>
        {list.tags.length === 0 ? (
          <p className="text-brand-secondary/50 rounded-2xl bg-white/70 p-5 text-sm">
            No NFC tags have been provisioned.
          </p>
        ) : (
          list.tags.map((tag) => {
            const editAvailability = friendlyAvailability(
              editCodes[tag.id] ?? "",
              list,
              tag,
            );
            const friendlyUrl = tag.friendlyCode
              ? buildNfcUrl(siteUrl, tag.friendlyCode)
              : null;

            return (
              <article
                key={tag.id}
                className="border-brand-secondary/5 rounded-[1.75rem] border bg-white/90 p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-brand-secondary text-base font-bold">
                      {tag.label || "HydroPOP NFC tag"}
                    </p>
                    <p className="text-brand-secondary/45 mt-1 text-xs">
                      {tag.bottle.name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      tag.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-brand-secondary/8 text-brand-secondary/55"
                    }`}
                  >
                    {tag.status}
                  </span>
                </div>

                <BottleAmounts bottle={tag.bottle} unit={unit} />

                <dl className="mt-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-brand-secondary/45">
                      Last confirmed use
                    </dt>
                    <dd className="text-brand-secondary text-right font-semibold">
                      {formatLastUse(tag.lastConfirmedAt, timezone)}
                    </dd>
                  </div>
                </dl>

                {friendlyUrl ? (
                  <div className="border-brand-primary/15 mt-4 rounded-2xl border p-4">
                    <p className="text-brand-secondary/45 text-xs font-bold uppercase">
                      Recommended pilot URL
                    </p>
                    <p className="text-brand-primary mt-2 font-mono text-xs break-all">
                      {friendlyUrl}
                    </p>
                    {tag.status === "active" ? (
                      <div className="mt-3">
                        <CopyUrlButton
                          label="Copy friendly URL"
                          url={friendlyUrl}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-semibold text-red-700">
                        This code remains reserved, but the revoked URL is
                        unavailable.
                      </p>
                    )}
                  </div>
                ) : null}

                {tag.status === "active" ? (
                  <>
                    <form
                      action={(formData) => updateTag(tag, formData)}
                      className="mt-5 grid gap-3 sm:grid-cols-2"
                    >
                      <label className="text-brand-secondary/60 text-xs font-bold">
                        Tag label
                        <input
                          name="label"
                          defaultValue={tag.label ?? ""}
                          maxLength={80}
                          className={inputClassName}
                        />
                      </label>
                      <label className="text-brand-secondary/60 text-xs font-bold">
                        Assigned bottle
                        <select
                          name="bottleId"
                          defaultValue={tag.bottle.id}
                          className={inputClassName}
                        >
                          {list.assignableBottles.map((bottle) => (
                            <option key={bottle.id} value={bottle.id}>
                              {bottle.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-brand-secondary/60 text-xs font-bold sm:col-span-2">
                        Friendly pilot code
                        <input
                          name="friendlyCode"
                          value={editCodes[tag.id] ?? ""}
                          onChange={(event) =>
                            setEditCodes((current) => ({
                              ...current,
                              [tag.id]: event.target.value,
                            }))
                          }
                          maxLength={32}
                          autoCapitalize="none"
                          autoCorrect="off"
                          placeholder="bea-kitchen"
                          className={inputClassName}
                        />
                        <span
                          className={`mt-2 block ${
                            editAvailability.available
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {editAvailability.message}
                        </span>
                      </label>
                      {editAvailability.code &&
                      editAvailability.code !== tag.friendlyCode ? (
                        <p className="text-brand-secondary/45 font-mono text-xs break-all sm:col-span-2">
                          {buildNfcUrl(siteUrl, editAvailability.code)}
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={
                          pending !== null || !editAvailability.available
                        }
                        className="border-brand-primary/20 text-brand-primary h-11 rounded-xl border bg-white px-4 text-xs font-bold sm:col-span-2"
                      >
                        {pending === `update:${tag.id}`
                          ? "Saving…"
                          : "Save tag"}
                      </button>
                    </form>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => void rotateTag(tag.id)}
                        className="h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-xs font-bold text-amber-900"
                      >
                        {pending === `rotate:${tag.id}`
                          ? "Rotating…"
                          : "Rotate secure URL"}
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => void revokeTag(tag.id)}
                        className="h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700"
                      >
                        {pending === `revoke:${tag.id}`
                          ? "Revoking…"
                          : "Revoke tag"}
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <section className="bg-brand-secondary rounded-[1.75rem] p-5 text-white sm:p-6">
        <h2 className="text-lg font-bold">What one NFC confirmation means</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">
          HydroPOP records your normal fill amount. Partial fills are not
          detected automatically and must be corrected with manual intake,
          adjustment, or reversal in the app.
        </p>
      </section>
    </div>
  );
}
