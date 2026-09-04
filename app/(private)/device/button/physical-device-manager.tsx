"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ActionSpinner } from "@/components/action-feedback";
import type { ApiResponse } from "@/lib/contracts/api-response";
import type {
  IssuedPhysicalDeviceCredential,
  PhysicalDeviceList,
  PhysicalDeviceSummary,
} from "@/lib/contracts/physical-device";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

const inputClassName =
  "mt-2 h-12 w-full rounded-2xl border border-brand-secondary/10 bg-white px-4 text-sm text-brand-secondary outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10";

function formatTime(value: string | null, timezone: string): string {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(new Date(value))
    : "Never";
}

async function readApiResponse<Data>(
  response: Response,
): Promise<ApiResponse<Data>> {
  return (await response.json()) as ApiResponse<Data>;
}

function replaceDevice(
  list: PhysicalDeviceList,
  device: PhysicalDeviceSummary,
): PhysicalDeviceList {
  return {
    ...list,
    devices: list.devices.map((item) =>
      item.id === device.id ? device : item,
    ),
  };
}

export function PhysicalDeviceManager({
  initialList,
  timezone,
  unit,
}: {
  initialList: PhysicalDeviceList;
  timezone: string;
  unit: VolumeUnit;
}) {
  const [list, setList] = useState(initialList);
  const [credential, setCredential] =
    useState<IssuedPhysicalDeviceCredential | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createLock = useRef(false);
  const credentialRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (credential) {
      credentialRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      credentialRef.current?.focus({ preventScroll: true });
    }
  }, [credential]);

  async function createDevice(formData: FormData) {
    if (createLock.current || pending) return;

    createLock.current = true;
    setPending("create");
    setMessage(null);
    setCredential(null);

    try {
      const response = await fetch("/api/v1/physical-devices", {
        body: JSON.stringify({
          bottleId: formData.get("bottleId"),
          label: formData.get("label"),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload =
        await readApiResponse<IssuedPhysicalDeviceCredential>(response);

      if (payload.error) {
        createLock.current = false;
        setMessage(payload.error.message);
        return;
      }

      setList((current) => ({
        ...current,
        devices: [payload.data.device, ...current.devices],
      }));
      setCredential(payload.data);
      setCopied(false);
    } catch {
      createLock.current = false;
      setMessage("HydroPOP could not create the physical button.");
    } finally {
      setPending(null);
    }
  }

  async function copyCredential() {
    if (!credential) return;

    try {
      await navigator.clipboard.writeText(credential.rawToken);
      setCopied(true);
    } catch {
      setMessage("Copy failed. Select the token and copy it manually now.");
    }
  }

  function finishCredential() {
    createLock.current = false;
    setCredential(null);
    setCopied(false);
    setMessage(
      "Credential hidden. HydroPOP cannot show it again; create a new device if it was not saved.",
    );
  }

  async function updateDevice(deviceId: string, formData: FormData) {
    if (pending) return;
    setPending(`update:${deviceId}`);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/physical-devices/${deviceId}`, {
        body: JSON.stringify({
          bottleId: formData.get("bottleId"),
          label: formData.get("label"),
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const payload = await readApiResponse<PhysicalDeviceSummary>(response);

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      setList((current) => replaceDevice(current, payload.data));
      setMessage("Physical button settings saved.");
    } catch {
      setMessage("HydroPOP could not update this physical button.");
    } finally {
      setPending(null);
    }
  }

  async function revokeDevice(deviceId: string) {
    if (pending) return;
    setPending(`revoke:${deviceId}`);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/v1/physical-devices/${deviceId}/revoke`,
        { method: "POST" },
      );
      const payload = await readApiResponse<PhysicalDeviceSummary>(response);

      if (payload.error) {
        setMessage(payload.error.message);
        return;
      }

      setList((current) => replaceDevice(current, payload.data));
      setMessage("Device revoked. Its credential stopped working immediately.");
    } catch {
      setMessage("HydroPOP could not revoke this physical button.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-8 grid gap-6">
      <section className="border-brand-secondary/5 rounded-[2rem] border bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-7">
        <h2 className="text-brand-secondary text-xl font-bold">
          Create a physical button
        </h2>
        <p className="text-brand-secondary/50 mt-2 text-sm leading-6">
          The token is generated by HydroPOP and shown once. Save it securely
          before leaving this screen.
        </p>

        {list.assignableBottles.length ? (
          <form
            action={createDevice}
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
            <label className="text-brand-secondary/70 text-sm font-semibold">
              Button label
              <input
                name="label"
                required
                maxLength={80}
                placeholder="Bea Bottle Button"
                className={inputClassName}
              />
            </label>
            <label className="text-brand-secondary/70 text-sm font-semibold">
              Active bottle
              <select name="bottleId" required className={inputClassName}>
                {list.assignableBottles.map((bottle) => (
                  <option key={bottle.id} value={bottle.id}>
                    {bottle.name} · records{" "}
                    {formatDisplayVolume(bottle.normalCompletionMl, unit)}{" "}
                    {unit}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={pending !== null || credential !== null}
              className="bg-brand-primary h-12 rounded-2xl px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 sm:col-span-2"
            >
              {pending === "create" ? (
                <span className="inline-flex items-center gap-2">
                  <ActionSpinner /> Creating…
                </span>
              ) : (
                "Create credential"
              )}
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            Create an active bottle before setting up physical hardware.{" "}
            <Link href="/settings/bottle" className="font-bold underline">
              Open bottle settings
            </Link>
          </div>
        )}
      </section>

      {credential ? (
        <section
          ref={credentialRef}
          tabIndex={-1}
          className="rounded-[2rem] border-2 border-emerald-300 bg-emerald-50 p-5 outline-none sm:p-7"
        >
          <p className="text-xs font-bold tracking-[0.14em] text-emerald-700 uppercase">
            Copy now · shown once
          </p>
          <h2 className="text-brand-secondary mt-2 text-xl font-bold">
            {credential.device.label} is ready
          </h2>
          <p className="mt-4 rounded-2xl bg-white p-4 font-mono text-xs break-all select-all">
            {credential.rawToken}
          </p>
          <p className="mt-3 text-xs leading-5 text-emerald-950/70">
            Store this as the device token. Do not put it in a URL, log, or
            source-control file. HydroPOP stores only its SHA-256 digest.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void copyCredential()}
              className="bg-brand-primary h-11 rounded-xl px-4 text-xs font-bold text-white"
            >
              {copied ? "Copied! ✓" : "Copy device token"}
            </button>
            <button
              type="button"
              onClick={finishCredential}
              className="border-brand-secondary/10 text-brand-secondary h-11 rounded-xl border bg-white px-4 text-xs font-bold"
            >
              I saved it securely
            </button>
          </div>
        </section>
      ) : null}

      {message ? (
        <p
          role="status"
          className="border-brand-secondary/5 rounded-2xl border bg-white p-4 text-sm font-semibold"
        >
          {message}
        </p>
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-brand-secondary text-xl font-bold">
          Your physical buttons
        </h2>
        {list.devices.length === 0 ? (
          <p className="text-brand-secondary/50 rounded-2xl bg-white/70 p-5 text-sm">
            No physical buttons have been created.
          </p>
        ) : (
          list.devices.map((device) => {
            const bottle = list.assignableBottles.find(
              (item) => item.id === device.bottleId,
            );

            return (
              <article
                key={device.id}
                className="border-brand-secondary/5 rounded-[1.75rem] border bg-white/90 p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-brand-secondary font-bold">
                      {device.label}
                    </h3>
                    <p className="text-brand-secondary/45 mt-1 text-xs">
                      {bottle?.name ?? "Previously assigned bottle"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      device.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-brand-secondary/8 text-brand-secondary/55"
                    }`}
                  >
                    {device.status}
                  </span>
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="bg-brand-background rounded-xl p-3">
                    <dt className="text-brand-secondary/45 text-xs">
                      Last successful sync
                    </dt>
                    <dd className="text-brand-secondary mt-1 font-bold">
                      {formatTime(device.lastSuccessfulSyncAt, timezone)}
                    </dd>
                  </div>
                  <div className="bg-brand-background rounded-xl p-3">
                    <dt className="text-brand-secondary/45 text-xs">Created</dt>
                    <dd className="text-brand-secondary mt-1 font-bold">
                      {formatTime(device.createdAt, timezone)}
                    </dd>
                  </div>
                </dl>

                {device.status === "active" ? (
                  <form
                    action={(formData) => updateDevice(device.id, formData)}
                    className="mt-5 grid gap-4 sm:grid-cols-2"
                  >
                    <label className="text-brand-secondary/70 text-sm font-semibold">
                      Label
                      <input
                        name="label"
                        required
                        maxLength={80}
                        defaultValue={device.label}
                        className={inputClassName}
                      />
                    </label>
                    <label className="text-brand-secondary/70 text-sm font-semibold">
                      Assigned bottle
                      <select
                        name="bottleId"
                        required
                        defaultValue={device.bottleId}
                        className={inputClassName}
                      >
                        {list.assignableBottles.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name} · records{" "}
                            {formatDisplayVolume(
                              option.normalCompletionMl,
                              unit,
                            )}{" "}
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-3 sm:col-span-2">
                      <button
                        type="submit"
                        disabled={pending !== null}
                        className="bg-brand-primary h-11 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {pending === `update:${device.id}`
                          ? "Saving…"
                          : "Save assignment"}
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => void revokeDevice(device.id)}
                        className="h-11 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-red-700 disabled:opacity-60"
                      >
                        {pending === `revoke:${device.id}`
                          ? "Revoking…"
                          : "Revoke device"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-4 text-xs text-red-700">
                    Revoked {formatTime(device.revokedAt, timezone)}. Its token
                    cannot be recovered or reactivated.
                  </p>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
