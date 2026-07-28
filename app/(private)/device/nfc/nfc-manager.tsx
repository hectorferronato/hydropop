"use client";

import Link from "next/link";
import { useState } from "react";

import type { ApiResponse } from "@/lib/contracts/api-response";
import type {
  IssuedNfcCredential,
  NfcTagList,
  NfcTagSummary,
} from "@/lib/contracts/nfc";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

const inputClassName =
  "mt-2 h-12 w-full rounded-2xl border border-brand-secondary/10 bg-white px-4 text-sm text-brand-secondary outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10";

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

export function NfcManager({
  initialList,
  timezone,
  unit,
}: {
  initialList: NfcTagList;
  timezone: string;
  unit: VolumeUnit;
}) {
  const [list, setList] = useState(initialList);
  const [credential, setCredential] = useState<IssuedNfcCredential | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  function replaceTag(tag: NfcTagSummary) {
    setList((current) => ({
      ...current,
      tags: current.tags.map((item) => (item.id === tag.id ? tag : item)),
    }));
  }

  async function createTag(formData: FormData) {
    setCredential(null);
    setMessage(null);
    setPending("create");

    try {
      const response = await fetch("/api/v1/nfc-tags", {
        body: JSON.stringify({
          bottleId: formData.get("bottleId"),
          label: formData.get("label"),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = await readApiResponse<IssuedNfcCredential>(response);

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      setList((current) => ({
        ...current,
        tags: [payload.data.tag, ...current.tags],
      }));
      setCredential(payload.data);
      setMessage("NFC tag created. Copy the private URL now.");
    } catch {
      setMessage("HydroPOP could not create the NFC tag.");
    } finally {
      setPending(null);
    }
  }

  async function rotateTag(tagId: string) {
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
      setCredential(payload.data);
      setMessage("Token rotated. The previous NFC URL no longer works.");
    } catch {
      setMessage("HydroPOP could not rotate this NFC token.");
    } finally {
      setPending(null);
    }
  }

  async function revokeTag(tagId: string) {
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
        "Tag revoked. Its NFC URL stopped working without deleting history.",
      );
    } catch {
      setMessage("HydroPOP could not revoke this NFC tag.");
    } finally {
      setPending(null);
    }
  }

  async function updateTag(tagId: string, formData: FormData) {
    setCredential(null);
    setMessage(null);
    setPending(`update:${tagId}`);

    try {
      const response = await fetch(`/api/v1/nfc-tags/${tagId}`, {
        body: JSON.stringify({
          bottleId: formData.get("bottleId"),
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
        "Tag assignment saved. Historical hydration events were unchanged.",
      );
    } catch {
      setMessage("HydroPOP could not update this NFC tag.");
    } finally {
      setPending(null);
    }
  }

  async function copyUrl() {
    if (!credential) {
      return;
    }

    await navigator.clipboard.writeText(credential.nfcUrl);
    setMessage("Private NFC URL copied.");
  }

  return (
    <div className="mt-8 grid gap-6">
      <section className="border-brand-secondary/5 rounded-[2rem] border bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-7">
        <h2 className="text-brand-secondary text-xl font-bold">Create a tag</h2>
        <p className="text-brand-secondary/50 mt-2 text-sm leading-6">
          The URL acts as a secret locator. Authentication and bottle ownership
          are still required before anything can be recorded.
        </p>

        {list.assignableBottles.length > 0 ? (
          <form action={createTag} className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-brand-secondary/70 text-sm font-semibold">
              Active bottle
              <select name="bottleId" required className={inputClassName}>
                {list.assignableBottles.map((bottle) => (
                  <option key={bottle.id} value={bottle.id}>
                    {bottle.name} ·{" "}
                    {formatDisplayVolume(bottle.normalFillMl, unit)} {unit}
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
            <button
              type="submit"
              disabled={pending !== null}
              className="bg-brand-primary hover:bg-brand-primary/90 h-12 rounded-2xl px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 sm:col-span-2"
            >
              {pending === "create" ? "Creating…" : "Create NFC tag"}
            </button>
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
          role="status"
          className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5 sm:p-7"
        >
          <p className="text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">
            Displayed once
          </p>
          <h2 className="text-brand-secondary mt-2 text-xl font-bold">
            Copy your private NFC URL now
          </h2>
          <p className="mt-2 text-sm leading-6 text-emerald-900/70">
            HydroPOP stores only its SHA-256 hash. After you leave or dismiss
            this state, the raw token cannot be recovered from the database.
          </p>
          <div className="mt-5 overflow-x-auto rounded-2xl bg-white p-4 font-mono text-xs text-emerald-950">
            {credential.nfcUrl}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="bg-brand-primary h-12 rounded-2xl px-5 text-sm font-bold text-white"
            >
              Copy NFC URL
            </button>
            <button
              type="button"
              onClick={() => setCredential(null)}
              className="h-12 rounded-2xl border border-emerald-300 bg-white px-5 text-sm font-bold text-emerald-900"
            >
              Done
            </button>
          </div>

          <h3 className="text-brand-secondary mt-7 text-sm font-bold">
            Write the URL to the physical tag
          </h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-emerald-950/70">
            <li>Copy the complete NFC URL.</li>
            <li>Open an NFC-writing app on your phone.</li>
            <li>Choose a URL/URI record.</li>
            <li>Paste the HydroPOP URL.</li>
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
          list.tags.map((tag) => (
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
                    {tag.bottle.name} ·{" "}
                    {formatDisplayVolume(tag.bottle.normalFillMl, unit)} {unit}
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

              {tag.status === "active" ? (
                <>
                  <form
                    action={(formData) => updateTag(tag.id, formData)}
                    className="mt-5 grid gap-3 sm:grid-cols-2"
                  >
                    <input
                      name="label"
                      defaultValue={tag.label ?? ""}
                      maxLength={80}
                      aria-label={`Label for ${tag.label || "NFC tag"}`}
                      className={inputClassName}
                    />
                    <select
                      name="bottleId"
                      defaultValue={tag.bottle.id}
                      aria-label={`Bottle for ${tag.label || "NFC tag"}`}
                      className={inputClassName}
                    >
                      {list.assignableBottles.map((bottle) => (
                        <option key={bottle.id} value={bottle.id}>
                          {bottle.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={pending !== null}
                      className="border-brand-primary/20 text-brand-primary h-11 rounded-xl border bg-white px-4 text-xs font-bold"
                    >
                      {pending === `update:${tag.id}`
                        ? "Saving…"
                        : "Save assignment"}
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
                        : "Rotate token"}
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
          ))
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
