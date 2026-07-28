"use client";

import { useActionState } from "react";

import type { SetupFormValues } from "@/lib/contracts/setup";

import { saveBottleSettings } from "../actions";
import {
  SettingsFieldError,
  SettingsFormActions,
  SettingsFormMessage,
  settingsInputClassName,
} from "../settings-form-controls";
import { initialSettingsActionState } from "../state";

type BottleValues = Pick<
  SetupFormValues,
  | "bottleBrand"
  | "bottleCapacity"
  | "bottleModel"
  | "bottleName"
  | "bottleTypicalFill"
  | "preferredUnit"
>;

export function BottleForm({ initialValues }: { initialValues: BottleValues }) {
  const [state, formAction] = useActionState(
    saveBottleSettings,
    initialSettingsActionState,
  );

  return (
    <form
      action={formAction}
      className="border-brand-secondary/5 mt-8 max-w-2xl rounded-[2rem] border bg-white/85 p-5 shadow-[0_22px_70px_rgba(15,23,42,0.06)] sm:p-8"
    >
      <div className="space-y-6">
        <div>
          <label
            htmlFor="bottleName"
            className="text-brand-secondary/70 text-sm font-semibold"
          >
            Bottle name
          </label>
          <input
            id="bottleName"
            name="bottleName"
            required
            maxLength={80}
            defaultValue={initialValues.bottleName}
            className={settingsInputClassName}
          />
          <SettingsFieldError field="bottleName" state={state} />
        </div>

        <div>
          <label
            htmlFor="bottleCapacity"
            className="text-brand-secondary/70 text-sm font-semibold"
          >
            Capacity in {initialValues.preferredUnit}
          </label>
          <div className="relative">
            <input
              id="bottleCapacity"
              name="bottleCapacity"
              type="number"
              inputMode="decimal"
              min="0.1"
              step={initialValues.preferredUnit === "oz" ? "0.1" : "1"}
              required
              defaultValue={initialValues.bottleCapacity}
              className={`${settingsInputClassName} pr-16`}
            />
            <span className="text-brand-secondary/40 pointer-events-none absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-sm font-bold">
              {initialValues.preferredUnit}
            </span>
          </div>
          <SettingsFieldError field="bottleCapacity" state={state} />
        </div>

        <div>
          <label
            htmlFor="bottleTypicalFill"
            className="text-brand-secondary/70 text-sm font-semibold"
          >
            Typical fill amount{" "}
            <span className="font-normal opacity-50">optional</span>
          </label>
          <div className="relative">
            <input
              id="bottleTypicalFill"
              name="bottleTypicalFill"
              type="number"
              inputMode="decimal"
              min="0.1"
              step={initialValues.preferredUnit === "oz" ? "0.1" : "1"}
              defaultValue={initialValues.bottleTypicalFill}
              placeholder={initialValues.bottleCapacity}
              className={`${settingsInputClassName} pr-16`}
            />
            <span className="text-brand-secondary/40 pointer-events-none absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-sm font-bold">
              {initialValues.preferredUnit}
            </span>
          </div>
          <p className="text-brand-secondary/40 mt-2 text-xs leading-5">
            How much water you normally put into the bottle. Leave blank and
            HydroPOP will use its full capacity.
          </p>
          <SettingsFieldError field="bottleTypicalFill" state={state} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="bottleBrand"
              className="text-brand-secondary/70 text-sm font-semibold"
            >
              Brand <span className="font-normal opacity-50">optional</span>
            </label>
            <input
              id="bottleBrand"
              name="bottleBrand"
              maxLength={80}
              defaultValue={initialValues.bottleBrand}
              className={settingsInputClassName}
            />
            <SettingsFieldError field="bottleBrand" state={state} />
          </div>
          <div>
            <label
              htmlFor="bottleModel"
              className="text-brand-secondary/70 text-sm font-semibold"
            >
              Model <span className="font-normal opacity-50">optional</span>
            </label>
            <input
              id="bottleModel"
              name="bottleModel"
              maxLength={80}
              defaultValue={initialValues.bottleModel}
              className={settingsInputClassName}
            />
            <SettingsFieldError field="bottleModel" state={state} />
          </div>
        </div>

        <div className="border-brand-primary/15 bg-brand-primary/5 rounded-2xl border p-4">
          <p className="text-brand-secondary text-sm font-bold">
            Press HydroPOP after the final sip
          </p>
          <p className="text-brand-secondary/45 mt-1 text-xs leading-5">
            Each press records your normal fill amount. Partial fills are not
            detected automatically and must be corrected in the app. Saving
            updates this bottle without creating a duplicate.
          </p>
        </div>
      </div>

      <SettingsFormMessage state={state} />
      <SettingsFormActions />
    </form>
  );
}
