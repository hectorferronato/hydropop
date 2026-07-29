export const todayRefreshIntervalMs = 5_000;
export const urgentRefreshDebounceMs = 750;

type WindowRefreshEvent =
  "focus" | "hydropop:hydration-mutated" | "offline" | "online";

export type VisibleRefreshEnvironment = {
  addDocumentListener: (type: "visibilitychange", listener: () => void) => void;
  addWindowListener: (type: WindowRefreshEvent, listener: () => void) => void;
  clearInterval: (timer: unknown) => void;
  isOnline: () => boolean;
  isVisible: () => boolean;
  now: () => number;
  removeDocumentListener: (
    type: "visibilitychange",
    listener: () => void,
  ) => void;
  removeWindowListener: (
    type: WindowRefreshEvent,
    listener: () => void,
  ) => void;
  setInterval: (listener: () => void, intervalMs: number) => unknown;
};

export function createVisibleRefreshController({
  environment,
  intervalMs = todayRefreshIntervalMs,
  refresh,
  urgentDebounceMs = urgentRefreshDebounceMs,
}: {
  environment: VisibleRefreshEnvironment;
  intervalMs?: number;
  refresh: () => Promise<void> | void;
  urgentDebounceMs?: number;
}) {
  let interval: unknown;
  let inFlight = false;
  let lastUrgentRefreshAt = Number.NEGATIVE_INFINITY;
  let started = false;

  function isEligible() {
    return environment.isVisible() && environment.isOnline();
  }

  function requestRefresh(urgent = false): boolean {
    if (!started || !isEligible() || inFlight) {
      return false;
    }

    const now = environment.now();

    if (urgent && now - lastUrgentRefreshAt < urgentDebounceMs) {
      return false;
    }

    if (urgent) {
      lastUrgentRefreshAt = now;
    }

    inFlight = true;
    void Promise.resolve()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
    return true;
  }

  function syncInterval() {
    if (isEligible()) {
      interval ??= environment.setInterval(
        () => requestRefresh(false),
        intervalMs,
      );
      return;
    }

    if (interval !== undefined) {
      environment.clearInterval(interval);
      interval = undefined;
    }
  }

  function handleFocus() {
    syncInterval();
    requestRefresh(true);
  }

  function handleVisibilityChange() {
    syncInterval();

    if (environment.isVisible()) {
      requestRefresh(true);
    }
  }

  function handleOnline() {
    syncInterval();
    requestRefresh(true);
  }

  function handleOffline() {
    syncInterval();
  }

  function start() {
    if (started) {
      return;
    }

    started = true;
    environment.addWindowListener("focus", handleFocus);
    environment.addWindowListener("online", handleOnline);
    environment.addWindowListener("offline", handleOffline);
    environment.addWindowListener("hydropop:hydration-mutated", handleFocus);
    environment.addDocumentListener("visibilitychange", handleVisibilityChange);
    syncInterval();
  }

  function stop() {
    if (!started) {
      return;
    }

    started = false;
    environment.removeWindowListener("focus", handleFocus);
    environment.removeWindowListener("online", handleOnline);
    environment.removeWindowListener("offline", handleOffline);
    environment.removeWindowListener("hydropop:hydration-mutated", handleFocus);
    environment.removeDocumentListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    if (interval !== undefined) {
      environment.clearInterval(interval);
      interval = undefined;
    }
  }

  return {
    isRefreshPending: () => inFlight,
    requestRefresh,
    start,
    stop,
  };
}
