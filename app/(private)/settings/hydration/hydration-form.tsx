"use client";

import { useActionState } from "react";

import type { SetupFormValues } from "@/lib/contracts/setup";

import { saveHydrationSettings } from "../actions";
import {
  SettingsFieldError,
  SettingsFormActions,
  SettingsFormMessage,
  settingsInputClassName,
} from "../settings-form-controls";
import { initialSettingsActionState } from "../state";

type HydrationValues = Pick<
  SetupFormValues,
  "dailyGoal" | "preferredUnit" | "targetCompletionTime"
>;

export function HydrationForm({
  initialValues,
}: {
  initialValues: HydrationValues;
}) {
  const [state, formAction] = useActionState(
    saveHydrationSettings,
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
            htmlFor="dailyGoal"
            className="text-brand-secondary/70 text-sm font-semibold"
          >
            Daily goal in {initialValues.preferredUnit}
          </label>
          <div className="relative">
            <input
              id="dailyGoal"
              name="dailyGoal"
              type="number"
              inputMode="decimal"
              min="0.1"
              step={initialValues.preferredUnit === "oz" ? "0.1" : "1"}
              required
              defaultValue={initialValues.dailyGoal}
              className={`${settingsInputClassName} pr-16 text-lg font-bold`}
            />
            <span className="text-brand-secondary/40 pointer-events-none absolute top-1/2 right-4 mt-1 -translate-y-1/2 text-sm font-bold">
              {initialValues.preferredUnit}
            </span>
          </div>
          <SettingsFieldError field="dailyGoal" state={state} />
          <p className="text-brand-secondary/40 mt-2 text-xs leading-5">
            HydroPOP stores goals in milliliters and starts a new dated goal
            when the active plan changes.
          </p>
        </div>

        <div>
          <label
            htmlFor="hydrationTargetCompletionTime"
            className="text-brand-secondary/70 text-sm font-semibold"
          >
            Target completion time
          </label>
          <input
            id="hydrationTargetCompletionTime"
            name="targetCompletionTime"
            type="time"
            required
            defaultValue={initialValues.targetCompletionTime}
            className={settingsInputClassName}
          />
          <SettingsFieldError field="targetCompletionTime" state={state} />
        </div>
      </div>

      <SettingsFormMessage state={state} />
      <SettingsFormActions />
    </form>
  );
}
