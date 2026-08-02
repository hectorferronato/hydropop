"use client";

import { useEffect, useState } from "react";

import type { HydrationSuccessPayload } from "@/lib/contracts/hydration-success";
import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

const particlePositions = [
  { delay: "0ms", left: "8%" },
  { delay: "60ms", left: "20%" },
  { delay: "120ms", left: "34%" },
  { delay: "20ms", left: "48%" },
  { delay: "90ms", left: "62%" },
  { delay: "150ms", left: "76%" },
  { delay: "40ms", left: "90%" },
] as const;

export function HydrationSuccessCelebration({
  result,
  unit,
}: {
  result: HydrationSuccessPayload;
  unit: VolumeUnit;
}) {
  const [showParticles, setShowParticles] = useState(result.isNew);

  useEffect(() => {
    if (!result.isNew) {
      return;
    }

    const timer = window.setTimeout(() => setShowParticles(false), 1_400);
    return () => window.clearTimeout(timer);
  }, [result.isNew]);

  const amount = `${formatDisplayVolume(result.amountRecordedMl, unit)} ${unit}`;
  const total = `${formatDisplayVolume(result.updatedDailyTotalMl, unit)} ${unit}`;
  const announcement = result.isNew
    ? `${amount} recorded. Today’s total is ${total}.`
    : `This action was already recorded. Today’s total is ${total}.`;

  return (
    <div
      className={`hydration-celebration relative overflow-hidden rounded-[1.5rem] border p-5 text-center ${
        result.isNew
          ? "border-emerald-200 bg-emerald-50"
          : "border-brand-secondary/10 bg-brand-background"
      }`}
      data-celebration={
        result.isNew ? (result.semantic === "full" ? "full" : "half") : "none"
      }
    >
      {showParticles ? (
        <div
          aria-hidden="true"
          className={`hydration-particles absolute inset-0 ${
            result.semantic === "half" ? "hydration-particles--compact" : ""
          }`}
        >
          {particlePositions.map((particle) => (
            <span
              key={`${particle.left}-${particle.delay}`}
              className="hydration-particle"
              style={{
                animationDelay: particle.delay,
                left: particle.left,
              }}
            />
          ))}
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="hydration-success-check relative mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600 text-xl font-bold text-white"
      >
        ✓
      </div>
      <p className="text-brand-secondary relative mt-3 text-lg font-bold">
        {result.isNew
          ? result.semantic === "full"
            ? "Bottle recorded"
            : "Half recorded"
          : "Already recorded"}
      </p>
      <p className="text-brand-primary relative mt-1 text-3xl font-bold">
        +{amount}
      </p>
      <p className="text-brand-secondary/55 relative mt-2 text-sm">
        Today: {total}
        {result.goalPercentage === null
          ? ""
          : ` · ${Math.round(result.goalPercentage)}% of goal`}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
