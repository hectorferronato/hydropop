"use client";

import { useEffect, useState } from "react";

import {
  readSoundEffectsPreference,
  writeSoundEffectsPreference,
} from "@/lib/application/celebration/sound-effects-preference";

export function SoundEffectsPreference() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEnabled(readSoundEffectsPreference());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function toggle() {
    setEnabled((current) => {
      const next = !current;
      writeSoundEffectsPreference(next);
      return next;
    });
  }

  return (
    <section className="border-brand-secondary/5 mt-7 rounded-[1.75rem] border bg-white/85 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-5">
        <div>
          <h2 className="text-brand-secondary text-lg font-bold">
            Sound effects
          </h2>
          <p className="text-brand-secondary/50 mt-1 max-w-lg text-sm leading-6">
            Play a short confirmation sound after water is recorded.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Sound effects: ${enabled ? "On" : "Off"}`}
          onClick={toggle}
          className={`relative h-11 w-[4.75rem] shrink-0 rounded-full p-1 transition ${
            enabled ? "bg-brand-primary" : "bg-brand-secondary/20"
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex size-9 items-center justify-center rounded-full bg-white text-[0.65rem] font-bold shadow-sm transition-transform ${
              enabled
                ? "text-brand-primary translate-x-7"
                : "text-brand-secondary/55 translate-x-0"
            }`}
          >
            {enabled ? "On" : "Off"}
          </span>
        </button>
      </div>
    </section>
  );
}
