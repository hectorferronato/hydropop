let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (
    typeof window === "undefined" ||
    typeof window.AudioContext === "undefined"
  ) {
    return null;
  }

  sharedAudioContext ??= new window.AudioContext();
  return sharedAudioContext;
}

export function prepareHydropopChime(): void {
  try {
    const context = getAudioContext();

    if (context?.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
  } catch {
    // Audio support is optional and must never block hydration.
  }
}

export function playHydropopChime(): void {
  try {
    const context = getAudioContext();

    if (!context || context.state === "closed") {
      return;
    }

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    const startAt = context.currentTime + 0.015;
    const notes = [
      { delay: 0, frequency: 493.88, length: 0.3, peak: 0.075 },
      { delay: 0.09, frequency: 622.25, length: 0.34, peak: 0.065 },
      { delay: 0.18, frequency: 783.99, length: 0.38, peak: 0.055 },
    ] as const;

    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startAt + note.delay;
      const noteEnd = noteStart + note.length;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.linearRampToValueAtTime(note.peak, noteStart + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.addEventListener(
        "ended",
        () => {
          oscillator.disconnect();
          gain.disconnect();
        },
        { once: true },
      );
      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.01);
    }
  } catch {
    // Visual confirmation remains authoritative if Web Audio is unavailable.
  }
}
