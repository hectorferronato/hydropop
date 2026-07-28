"use client";

import { useActionState } from "react";

import type { SetupFormValues } from "@/lib/contracts/setup";

import { saveProfileSettings } from "../actions";
import {
  SettingsFieldError,
  SettingsFormActions,
  SettingsFormMessage,
  settingsInputClassName,
} from "../settings-form-controls";
import { initialSettingsActionState } from "../state";

type ProfileValues = Pick<
  SetupFormValues,
  | "displayName"
  | "preferredUnit"
  | "targetCompletionTime"
  | "timezone"
  | "wakeTime"
>;

export function ProfileForm({
  initialValues,
  timezones,
}: {
  initialValues: ProfileValues;
  timezones: readonly string[];
}) {
  const [state, formAction] = useActionState(
    saveProfileSettings,
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
            htmlFor="displayName"
            className="text-brand-secondary/70 text-sm font-semibold"
          >
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={80}
            defaultValue={initialValues.displayName}
            className={settingsInputClassName}
          />
          <SettingsFieldError field="displayName" state={state} />
        </div>

        <div>
          <label
            htmlFor="timezone"
            className="text-brand-secondary/70 text-sm font-semibold"
          >
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            required
            defaultValue={initialValues.timezone}
            className={settingsInputClassName}
          >
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <SettingsFieldError field="timezone" state={state} />
        </div>

        <div>
          <label
            htmlFor="preferredUnit"
            className="text-brand-secondary/70 text-sm font-semibold"
          >
            Preferred unit
          </label>
          <select
            id="preferredUnit"
            name="preferredUnit"
            defaultValue={initialValues.preferredUnit}
            className={settingsInputClassName}
          >
            <option value="oz">Ounces (oz)</option>
            <option value="ml">Milliliters (ml)</option>
          </select>
          <SettingsFieldError field="preferredUnit" state={state} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="wakeTime"
              className="text-brand-secondary/70 text-sm font-semibold"
            >
              Wake time
            </label>
            <input
              id="wakeTime"
              name="wakeTime"
              type="time"
              required
              defaultValue={initialValues.wakeTime}
              className={settingsInputClassName}
            />
            <SettingsFieldError field="wakeTime" state={state} />
          </div>
          <div>
            <label
              htmlFor="profileTargetCompletionTime"
              className="text-brand-secondary/70 text-sm font-semibold"
            >
              Target completion time
            </label>
            <input
              id="profileTargetCompletionTime"
              name="targetCompletionTime"
              type="time"
              required
              defaultValue={initialValues.targetCompletionTime}
              className={settingsInputClassName}
            />
            <SettingsFieldError field="targetCompletionTime" state={state} />
          </div>
        </div>
      </div>

      <SettingsFormMessage state={state} />
      <SettingsFormActions />
    </form>
  );
}
