import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PageHeader } from "@/components/page-header";
import { toSettingsSummary } from "@/lib/application/settings/settings-summary";
import { requireAllowedUser } from "@/lib/infrastructure/supabase/auth";
import { getOnboardingSnapshot } from "@/lib/infrastructure/supabase/onboarding";
import { createClient } from "@/lib/infrastructure/supabase/server";

import { archivePrimaryBottle } from "./actions";

const missingConfigurationLabels = {
  activeGoal: "an active hydration goal",
  completedProfile: "completed profile information",
  primaryBottle: "an active primary bottle",
} as const;

function readParameter(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <dl className="border-brand-secondary/5 flex items-start justify-between gap-5 border-b py-3 last:border-b-0">
      <dt className="text-brand-secondary/45 text-sm">{label}</dt>
      <dd className="text-brand-secondary max-w-[65%] text-right text-sm font-semibold">
        {value}
      </dd>
    </dl>
  );
}

function SettingsCard({
  action,
  children,
  description,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="border-brand-secondary/5 rounded-[1.75rem] border bg-white/85 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-brand-secondary text-lg font-bold tracking-tight">
            {title}
          </h2>
          <p className="text-brand-secondary/45 mt-1 text-xs leading-5">
            {description}
          </p>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const editLinkClassName =
  "text-brand-primary hover:bg-brand-primary/8 focus-visible:outline-brand-primary shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    updated?: string | string[];
  }>;
}) {
  await connection();

  const user = await requireAllowedUser("/settings");
  const supabase = await createClient();
  const snapshot = await getOnboardingSnapshot(supabase, user.id);

  if (!snapshot.status.hasStartedConfiguration) {
    redirect("/setup");
  }

  const summary = toSettingsSummary(snapshot);
  const parameters = await searchParams;
  const updated = readParameter(parameters.updated);
  const error = readParameter(parameters.error);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Your HydroPOP setup"
        description="Review your profile, current hydration plan, and the bottle HydroPOP uses for progress."
      />

      {updated ? (
        <p
          role="status"
          className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          {updated === "bottle-archived"
            ? "Your bottle was archived. Choose a new primary bottle before logging hydration."
            : "Your settings were saved."}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-7 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          We couldn’t archive that bottle. Nothing was changed.
        </p>
      ) : null}

      {!snapshot.isComplete ? (
        <section
          role="alert"
          className="mt-7 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 sm:p-6"
        >
          <p className="text-xs font-bold tracking-[0.14em] text-amber-700 uppercase">
            Setup needs attention
          </p>
          <h2 className="text-brand-secondary mt-2 text-xl font-bold">
            Hydration logging is paused
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/70">
            Your account is missing{" "}
            {snapshot.status.missing
              .map((item) => missingConfigurationLabels[item])
              .join(", ")}
            . Complete these settings before creating hydration events.
          </p>
          <Link
            href="/setup?mode=complete"
            className="bg-brand-primary hover:bg-brand-primary/90 focus-visible:outline-brand-primary mt-5 inline-flex h-11 items-center rounded-2xl px-4 text-sm font-bold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Complete missing setup
          </Link>
        </section>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <SettingsCard
          title="Profile"
          description="Identity, schedule, timezone, and display preferences."
          action={
            snapshot.isComplete ? (
              <Link href="/settings/profile" className={editLinkClassName}>
                Edit profile
              </Link>
            ) : undefined
          }
        >
          <SummaryRow
            label="Display name"
            value={summary.profile.displayName}
          />
          <SummaryRow label="Timezone" value={summary.profile.timezone} />
          <SummaryRow
            label="Preferred unit"
            value={
              summary.profile.preferredUnit === "oz"
                ? "Ounces (oz)"
                : "Milliliters (ml)"
            }
          />
          <SummaryRow label="Wake time" value={summary.profile.wakeTime} />
          <SummaryRow
            label="Target time"
            value={summary.profile.targetCompletionTime}
          />
        </SettingsCard>

        <SettingsCard
          title="Hydration plan"
          description="The active date-effective target for your hydration day."
          action={
            snapshot.isComplete ? (
              <Link href="/settings/hydration" className={editLinkClassName}>
                Edit hydration plan
              </Link>
            ) : undefined
          }
        >
          {summary.goal ? (
            <>
              <SummaryRow label="Daily goal" value={summary.goal.dailyGoal} />
              <SummaryRow
                label="Effective date"
                value={summary.goal.effectiveDate}
              />
              <SummaryRow
                label="Target time"
                value={summary.goal.targetCompletionTime}
              />
            </>
          ) : (
            <p className="text-brand-secondary/50 py-3 text-sm">
              No active hydration goal is configured.
            </p>
          )}
        </SettingsCard>

        <div className="lg:col-span-2">
          <SettingsCard
            title="Primary bottle"
            description="The active bottle used for capacity-based hydration progress."
            action={
              summary.bottle && snapshot.isComplete ? (
                <Link href="/settings/bottle" className={editLinkClassName}>
                  Edit bottle
                </Link>
              ) : undefined
            }
          >
            {summary.bottle ? (
              <>
                <div className="grid gap-x-8 sm:grid-cols-2">
                  <div>
                    <SummaryRow
                      label="Bottle name"
                      value={summary.bottle.name}
                    />
                    <SummaryRow label="Brand" value={summary.bottle.brand} />
                    <SummaryRow label="Model" value={summary.bottle.model} />
                  </div>
                  <div>
                    <SummaryRow
                      label="Capacity"
                      value={summary.bottle.capacity}
                    />
                    <SummaryRow
                      label="Status"
                      value={
                        summary.bottle.isPrimary
                          ? "Active primary"
                          : "Not primary"
                      }
                    />
                  </div>
                </div>
                <div className="border-brand-secondary/5 mt-5 border-t pt-5">
                  <p className="text-brand-secondary/45 max-w-2xl text-xs leading-5">
                    Archiving removes this bottle from active use without
                    deleting hydration history. You will need to choose another
                    primary bottle before logging hydration.
                  </p>
                  <form action={archivePrimaryBottle}>
                    <label className="mt-4 flex max-w-xl cursor-pointer items-start gap-3 text-xs leading-5 text-red-800">
                      <input
                        type="checkbox"
                        required
                        className="mt-0.5 size-4 accent-red-700"
                      />
                      <span>
                        I understand that hydration logging will pause until I
                        configure another primary bottle.
                      </span>
                    </label>
                    <button
                      type="submit"
                      className="mt-4 h-11 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    >
                      Archive bottle
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <p className="py-3 text-sm font-semibold text-amber-800">
                No active primary bottle is configured.
              </p>
            )}
          </SettingsCard>
        </div>
      </div>
    </>
  );
}
