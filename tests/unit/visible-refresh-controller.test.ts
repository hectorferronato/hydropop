import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createVisibleRefreshController,
  todayRefreshIntervalMs,
  type VisibleRefreshEnvironment,
} from "@/lib/application/refresh/visible-refresh-controller";

type WindowRefreshEvent =
  "focus" | "hydropop:hydration-mutated" | "offline" | "online";

function testEnvironment() {
  const documentListeners = new Set<() => void>();
  const windowListeners = new Map<WindowRefreshEvent, Set<() => void>>();
  let online = true;
  let visible = true;

  const environment: VisibleRefreshEnvironment = {
    addDocumentListener: (_type, listener) => documentListeners.add(listener),
    addWindowListener: (type, listener) => {
      const listeners = windowListeners.get(type) ?? new Set<() => void>();
      listeners.add(listener);
      windowListeners.set(type, listeners);
    },
    clearInterval: (timer) =>
      clearInterval(timer as ReturnType<typeof setInterval>),
    isOnline: () => online,
    isVisible: () => visible,
    now: () => Date.now(),
    removeDocumentListener: (_type, listener) =>
      documentListeners.delete(listener),
    removeWindowListener: (type, listener) =>
      windowListeners.get(type)?.delete(listener),
    setInterval: (listener, intervalMs) => setInterval(listener, intervalMs),
  };

  return {
    documentListenerCount: () => documentListeners.size,
    emitDocument: () => {
      documentListeners.forEach((listener) => listener());
    },
    emitWindow: (type: WindowRefreshEvent) => {
      windowListeners.get(type)?.forEach((listener) => listener());
    },
    environment,
    setOnline: (value: boolean) => {
      online = value;
    },
    setVisible: (value: boolean) => {
      visible = value;
    },
    windowListenerCount: () =>
      [...windowListeners.values()].reduce(
        (total, listeners) => total + listeners.size,
        0,
      ),
  };
}

describe("visible refresh controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T15:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls on the bounded interval only while visible and online", async () => {
    const harness = testEnvironment();
    const refresh = vi.fn();
    const controller = createVisibleRefreshController({
      environment: harness.environment,
      refresh,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(todayRefreshIntervalMs - 1);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(todayRefreshIntervalMs);
    expect(refresh).toHaveBeenCalledTimes(2);

    harness.setVisible(false);
    harness.emitDocument();
    await vi.advanceTimersByTimeAsync(todayRefreshIntervalMs * 2);
    expect(refresh).toHaveBeenCalledTimes(2);

    harness.setVisible(true);
    harness.emitDocument();
    await vi.runAllTicks();
    expect(refresh).toHaveBeenCalledTimes(3);

    harness.setOnline(false);
    harness.emitWindow("offline");
    await vi.advanceTimersByTimeAsync(todayRefreshIntervalMs * 2);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("refreshes promptly on focus, visibility, online, and local mutation", async () => {
    const harness = testEnvironment();
    const refresh = vi.fn();
    const controller = createVisibleRefreshController({
      environment: harness.environment,
      refresh,
    });

    controller.start();
    harness.emitWindow("focus");
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(800);
    harness.emitWindow("hydropop:hydration-mutated");
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(2);

    harness.setVisible(false);
    harness.emitDocument();
    vi.advanceTimersByTime(800);
    harness.setVisible(true);
    harness.emitDocument();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(3);

    harness.setOnline(false);
    harness.emitWindow("offline");
    vi.advanceTimersByTime(800);
    harness.setOnline(true);
    harness.emitWindow("online");
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(4);
  });

  it("prevents overlapping refreshes", async () => {
    const harness = testEnvironment();
    let resolveRefresh: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const controller = createVisibleRefreshController({
      environment: harness.environment,
      refresh,
    });

    controller.start();
    await vi.advanceTimersByTimeAsync(todayRefreshIntervalMs * 3);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(controller.isRefreshPending()).toBe(true);

    resolveRefresh?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(todayRefreshIntervalMs);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("cleans up timers and listeners", async () => {
    const harness = testEnvironment();
    const refresh = vi.fn();
    const controller = createVisibleRefreshController({
      environment: harness.environment,
      refresh,
    });

    controller.start();
    expect(harness.documentListenerCount()).toBe(1);
    expect(harness.windowListenerCount()).toBe(4);

    controller.stop();
    expect(harness.documentListenerCount()).toBe(0);
    expect(harness.windowListenerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(todayRefreshIntervalMs * 2);
    expect(refresh).not.toHaveBeenCalled();
  });
});
