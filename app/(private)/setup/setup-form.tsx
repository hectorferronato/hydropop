"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { getSetupFormRevision } from "@/lib/application/onboarding/setup-form-values";
import type { SetupField, SetupFormValues } from "@/lib/contracts/setup";
import { convertDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

import { saveSetup } from "./actions";
import { initialSetupState, type SetupState } from "./state";

const steps = [
  { eyebrow: "Step 1 of 4", title: "About you" },
  { eyebrow: "Step 2 of 4", title: "Your hydration day" },
  { eyebrow: "Step 3 of 4", title: "Daily goal" },
  { eyebrow: "Step 4 of 4", title: "Primary bottle" },
] as const;

const fieldStep: Record<SetupField, number> = {
  bottleBrand: 3,
  bottleCapacity: 3,
  bottleId: 3,
  bottleIsPrimary: 3,
  bottleModel: 3,
  bottleName: 3,
  bottleTypicalFill: 3,
  dailyGoal: 2,
  displayName: 0,
  preferredUnit: 0,
  targetCompletionTime: 1,
  timezone: 0,
  wakeTime: 1,
};

const inputClassName =
  "mt-2 h-12 w-full rounded-2xl border border-brand-secondary/10 bg-white px-4 text-base text-brand-secondary outline-none transition placeholder:text-brand-secondary/25 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10";

function FieldError({
  field,
  state,
}: {
  field: SetupField;
  state: SetupState;
}) {
  const error = state.fieldErrors?.[field]?.[0];

  return error ? (
    <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>
  ) : null;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand-primary hover:bg-brand-primary/90 focus-visible:outline-brand-primary h-12 flex-1 rounded-2xl px-5 text-sm font-bold text-white shadow-lg shadow-[rgba(62,41,255,0.18)] transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save setup"}
    </button>
  );
}

function parseDisplayedVolume(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type SetupFormProps = {
  destination: string;
  initialStep: 0 | 2 | 3;
  initialValues: SetupFormValues;
  timezones: readonly string[];
};

function SetupFormFields({
  destination,
  initialStep,
  initialValues,
  timezones,
}: SetupFormProps) {
  const [state, formAction] = useActionState(saveSetup, initialSetupState);
  const [step, setStep] = useState<number>(initialStep);
  const [values, setValues] = useState(initialValues);
  const formRef = useRef<HTMLFormElement>(null);
  const firstInvalidField = Object.keys(state.fieldErrors ?? {})[0] as
    SetupField | undefined;

  function updateValue<Key extends keyof SetupFormValues>(
    key: Key,
    value: SetupFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function changeUnit(nextUnit: VolumeUnit) {
    if (nextUnit === values.preferredUnit) {
      return;
    }

    const currentGoal = parseDisplayedVolume(values.dailyGoal);
    const currentCapacity = parseDisplayedVolume(values.bottleCapacity);
    const currentTypicalFill = parseDisplayedVolume(values.bottleTypicalFill);

    setValues((current) => ({
      ...current,
      bottleCapacity:
        currentCapacity === null
          ? current.bottleCapacity
          : String(
              convertDisplayVolume(
                currentCapacity,
                current.preferredUnit,
                nextUnit,
              ),
            ),
      bottleTypicalFill:
        currentTypicalFill === null
          ? current.bottleTypicalFill
          : String(
              convertDisplayVolume(
                currentTypicalFill,
                current.preferredUnit,
                nextUnit,
              ),
            ),
      dailyGoal:
        currentGoal === null
          ? current.dailyGoal
          : String(
              convertDisplayVolume(
                currentGoal,
                current.preferredUnit,
                nextUnit,
              ),
            ),
      preferredUnit: nextUnit,
    }));
  }

  function advance() {
    if (formRef.current?.reportValidity()) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  const unitLabel = values.preferredUnit === "oz" ? "ounces" : "milliliters";
  const unitSymbol = values.preferredUnit;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-brand-secondary/5 mt-8 overflow-hidden rounded-[2rem] border bg-white/85 shadow-[0_22px_70px_rgba(15,23,42,0.06)]"
    >
      <input type="hidden" name="next" value={destination} />
      <input type="hidden" name="bottleId" value={values.bottleId} />
      <input type="hidden" name="displayName" value={values.displayName} />
      <input type="hidden" name="timezone" value={values.timezone} />
      <input type="hidden" name="preferredUnit" value={values.preferredUnit} />
      <input type="hidden" name="wakeTime" value={values.wakeTime} />
      <input
        type="hidden"
        name="targetCompletionTime"
        value={values.targetCompletionTime}
      />
      <input type="hidden" name="dailyGoal" value={values.dailyGoal} />
      <input type="hidden" name="bottleName" value={values.bottleName} />
      <input
        type="hidden"
        name="bottleCapacity"
        value={values.bottleCapacity}
      />
      <input
        type="hidden"
        name="bottleTypicalFill"
        value={values.bottleTypicalFill}
      />
      <input type="hidden" name="bottleBrand" value={values.bottleBrand} />
      <input type="hidden" name="bottleModel" value={values.bottleModel} />
      <input
        type="hidden"
        name="bottleIsPrimary"
        value={values.bottleIsPrimary ? "on" : "off"}
      />

      <div className="border-brand-secondary/5 border-b px-5 py-5 sm:px-8">
        <div className="flex items-center justify-between gap-5">
          <div>
            <p className="text-brand-primary text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              {steps[step]?.eyebrow}
            </p>
            <h2 className="text-brand-secondary mt-1 text-xl font-bold tracking-tight">
              {steps[step]?.title}
            </h2>
          </div>
          <span className="text-brand-secondary/35 text-xs font-semibold">
            {step + 1}/{steps.length}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2" aria-hidden="true">
          {steps.map((item, index) => (
            <span
              key={item.title}
              className={`h-1.5 rounded-full ${
                index <= step ? "bg-brand-primary" : "bg-brand-secondary/8"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="min-h-[26rem] px-5 py-7 sm:px-8">
        {step === 0 ? (
          <fieldset className="space-y-6">
            <legend className="sr-only">Profile and units</legend>
            <div>
              <label
                htmlFor="displayNameInput"
                className="text-brand-secondary/70 text-sm font-semibold"
              >
                Display name
              </label>
              <input
                id="displayNameInput"
                required
                maxLength={80}
                value={values.displayName}
                onChange={(event) =>
                  updateValue("displayName", event.target.value)
                }
                className={inputClassName}
                placeholder="How should we greet you?"
              />
              <FieldError field="displayName" state={state} />
            </div>

            <div>
              <label
                htmlFor="timezoneInput"
                className="text-brand-secondary/70 text-sm font-semibold"
              >
                Timezone
              </label>
              <select
                id="timezoneInput"
                required
                value={values.timezone}
                onChange={(event) =>
                  updateValue("timezone", event.target.value)
                }
                className={inputClassName}
              >
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <p className="text-brand-secondary/40 mt-2 text-xs leading-5">
                Hydration days use this timezone, including daylight-saving
                changes.
              </p>
              <FieldError field="timezone" state={state} />
            </div>

            <fieldset>
              <legend className="text-brand-secondary/70 text-sm font-semibold">
                Preferred unit
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(["oz", "ml"] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    aria-pressed={values.preferredUnit === unit}
                    onClick={() => changeUnit(unit)}
                    className={`h-14 rounded-2xl border text-sm font-bold transition ${
                      values.preferredUnit === unit
                        ? "border-brand-primary bg-brand-primary/8 text-brand-primary"
                        : "border-brand-secondary/10 text-brand-secondary/55 hover:border-brand-primary/30"
                    }`}
                  >
                    {unit === "oz" ? "Ounces (oz)" : "Milliliters (ml)"}
                  </button>
                ))}
              </div>
              <FieldError field="preferredUnit" state={state} />
            </fieldset>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="space-y-6">
            <legend className="sr-only">Hydration schedule</legend>
            <p className="text-brand-secondary/50 text-sm leading-6">
              These times shape your hydration day and future progress pacing.
            </p>
            <div>
              <label
                htmlFor="wakeTimeInput"
                className="text-brand-secondary/70 text-sm font-semibold"
              >
                Wake time
              </label>
              <input
                id="wakeTimeInput"
                type="time"
                required
                value={values.wakeTime}
                onChange={(event) =>
                  updateValue("wakeTime", event.target.value)
                }
                className={inputClassName}
              />
              <FieldError field="wakeTime" state={state} />
            </div>
            <div>
              <label
                htmlFor="targetCompletionTimeInput"
                className="text-brand-secondary/70 text-sm font-semibold"
              >
                Target completion time
              </label>
              <input
                id="targetCompletionTimeInput"
                type="time"
                required
                value={values.targetCompletionTime}
                onChange={(event) =>
                  updateValue("targetCompletionTime", event.target.value)
                }
                className={inputClassName}
              />
              <p className="text-brand-secondary/40 mt-2 text-xs leading-5">
                Aim to finish your daily goal by this time.
              </p>
              <FieldError field="targetCompletionTime" state={state} />
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <legend className="sr-only">Daily hydration goal</legend>
            <div className="bg-brand-primary/6 rounded-3xl p-5">
              <p className="text-brand-primary text-xs font-bold tracking-[0.14em] uppercase">
                Your daily target
              </p>
              <label
                htmlFor="dailyGoalInput"
                className="text-brand-secondary mt-4 block text-sm font-semibold"
              >
                Daily goal in {unitLabel}
              </label>
              <div className="relative">
                <input
                  id="dailyGoalInput"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step={values.preferredUnit === "oz" ? "0.1" : "1"}
                  required
                  value={values.dailyGoal}
                  onChange={(event) =>
                    updateValue("dailyGoal", event.target.value)
                  }
                  className={`${inputClassName} pr-16 text-lg font-bold`}
                />
                <span className="text-brand-secondary/40 pointer-events-none absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-sm font-bold">
                  {unitSymbol}
                </span>
              </div>
              <FieldError field="dailyGoal" state={state} />
            </div>
            <p className="text-brand-secondary/45 mt-5 text-sm leading-6">
              HydroPOP stores this as milliliters for consistent calculations
              and shows it in your preferred unit.
            </p>
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset className="space-y-5">
            <legend className="sr-only">Primary bottle</legend>
            <div>
              <label
                htmlFor="bottleNameInput"
                className="text-brand-secondary/70 text-sm font-semibold"
              >
                Bottle name
              </label>
              <input
                id="bottleNameInput"
                required
                maxLength={80}
                value={values.bottleName}
                onChange={(event) =>
                  updateValue("bottleName", event.target.value)
                }
                className={inputClassName}
                placeholder="Everyday bottle"
              />
              <FieldError field="bottleName" state={state} />
            </div>

            <div>
              <label
                htmlFor="bottleCapacityInput"
                className="text-brand-secondary/70 text-sm font-semibold"
              >
                Capacity in {unitLabel}
              </label>
              <div className="relative">
                <input
                  id="bottleCapacityInput"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step={values.preferredUnit === "oz" ? "0.1" : "1"}
                  required
                  value={values.bottleCapacity}
                  onChange={(event) =>
                    updateValue("bottleCapacity", event.target.value)
                  }
                  className={`${inputClassName} pr-16`}
                />
                <span className="text-brand-secondary/40 pointer-events-none absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-sm font-bold">
                  {unitSymbol}
                </span>
              </div>
              <FieldError field="bottleCapacity" state={state} />
            </div>

            <div>
              <label
                htmlFor="bottleTypicalFillInput"
                className="text-brand-secondary/70 text-sm font-semibold"
              >
                Typical fill amount{" "}
                <span className="font-normal opacity-50">optional</span>
              </label>
              <div className="relative">
                <input
                  id="bottleTypicalFillInput"
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step={values.preferredUnit === "oz" ? "0.1" : "1"}
                  value={values.bottleTypicalFill}
                  onChange={(event) =>
                    updateValue("bottleTypicalFill", event.target.value)
                  }
                  className={`${inputClassName} pr-16`}
                  placeholder={values.bottleCapacity}
                />
                <span className="text-brand-secondary/40 pointer-events-none absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-sm font-bold">
                  {unitSymbol}
                </span>
              </div>
              <p className="text-brand-secondary/40 mt-2 text-xs leading-5">
                How much water you normally put into this bottle. Leave blank
                and HydroPOP will use its full capacity.
              </p>
              <FieldError field="bottleTypicalFill" state={state} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="bottleBrandInput"
                  className="text-brand-secondary/70 text-sm font-semibold"
                >
                  Brand <span className="font-normal opacity-50">optional</span>
                </label>
                <input
                  id="bottleBrandInput"
                  maxLength={80}
                  value={values.bottleBrand}
                  onChange={(event) =>
                    updateValue("bottleBrand", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Owala"
                />
                <FieldError field="bottleBrand" state={state} />
              </div>
              <div>
                <label
                  htmlFor="bottleModelInput"
                  className="text-brand-secondary/70 text-sm font-semibold"
                >
                  Model <span className="font-normal opacity-50">optional</span>
                </label>
                <input
                  id="bottleModelInput"
                  maxLength={80}
                  value={values.bottleModel}
                  onChange={(event) =>
                    updateValue("bottleModel", event.target.value)
                  }
                  className={inputClassName}
                  placeholder="FreeSip"
                />
                <FieldError field="bottleModel" state={state} />
              </div>
            </div>

            <label className="border-brand-primary/15 bg-brand-primary/5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
              <input
                type="checkbox"
                required
                checked={values.bottleIsPrimary}
                onChange={(event) =>
                  updateValue("bottleIsPrimary", event.target.checked)
                }
                className="accent-brand-primary mt-0.5 size-5"
              />
              <span>
                <span className="text-brand-secondary block text-sm font-bold">
                  Make this my primary bottle
                </span>
                <span className="text-brand-secondary/45 mt-1 block text-xs leading-5">
                  Press HydroPOP after the final sip. Each press records your
                  normal fill amount.
                </span>
              </span>
            </label>
            <FieldError field="bottleIsPrimary" state={state} />
            <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-900/70">
              HydroPOP assumes each press represents your normal fill amount.
              Partial fills are not detected automatically and must be corrected
              in the app.
            </div>
          </fieldset>
        ) : null}

        {state.message ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
          >
            <p>{state.message}</p>
            {firstInvalidField && fieldStep[firstInvalidField] !== step ? (
              <button
                type="button"
                onClick={() => setStep(fieldStep[firstInvalidField])}
                className="mt-2 font-bold underline underline-offset-2"
              >
                Review the first field
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-brand-secondary/5 flex gap-3 border-t px-5 py-5 sm:px-8">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            className="border-brand-secondary/10 text-brand-secondary hover:border-brand-primary/30 h-12 rounded-2xl border bg-white px-5 text-sm font-bold transition"
          >
            Back
          </button>
        ) : null}
        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={advance}
            className="bg-brand-primary hover:bg-brand-primary/90 focus-visible:outline-brand-primary h-12 flex-1 rounded-2xl px-5 text-sm font-bold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Continue
          </button>
        ) : (
          <SubmitButton />
        )}
      </div>
    </form>
  );
}

export function SetupForm(props: SetupFormProps) {
  return (
    <SetupFormFields
      key={`${getSetupFormRevision(props.initialValues)}:${props.initialStep}`}
      {...props}
    />
  );
}
