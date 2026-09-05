import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
function worker(
  windows: {
    url: string;
    navigate: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
  }[] = [],
) {
  const listeners = new Map<string, (event: unknown) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        listeners.set(name, handler),
      registration: { showNotification },
      location: { origin: "https://hydropop.test" },
      clients: { matchAll: async () => windows, openWindow },
    },
  });
  return { listeners, showNotification, openWindow };
}
describe("push service worker execution", () => {
  it("rejects malformed payloads without throwing or recording water", () => {
    const w = worker();
    for (const data of [
      undefined,
      {
        json: () => {
          throw new Error("bad JSON");
        },
      },
      { json: () => ({ kind: "pace-reminder", target: "https://evil.test" }) },
    ])
      expect(() =>
        w.listeners.get("push")!({ data, waitUntil: vi.fn() }),
      ).not.toThrow();
    expect(w.showNotification).not.toHaveBeenCalled();
  });
  it("shows a bounded valid notification and opens the same-origin chooser", async () => {
    const w = worker();
    const pending: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => pending.push(p);
    w.listeners.get("push")!({
      data: {
        json: () => ({
          version: 1,
          kind: "pace-reminder",
          target: "/today?record=1&source=push",
          tag: "hydropop-pace",
          title: "Water",
          body: "A water break",
        }),
      },
      waitUntil,
    });
    expect(w.showNotification).toHaveBeenCalledOnce();
    w.listeners.get("notificationclick")!({
      notification: {
        close: vi.fn(),
        data: { target: "/today?record=1&source=push" },
      },
      waitUntil,
    });
    await Promise.all(pending);
    expect(w.openWindow).toHaveBeenCalledWith(
      "https://hydropop.test/today?record=1&source=push",
    );
  });
  it("does not navigate to an attacker-supplied origin", async () => {
    const w = worker();
    const pending: Promise<unknown>[] = [];
    w.listeners.get("notificationclick")!({
      notification: { close: vi.fn(), data: { target: "https://evil.test" } },
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    });
    await Promise.all(pending);
    expect(w.openWindow).toHaveBeenCalledWith("https://hydropop.test/today");
  });
  it("navigates before focus and tolerates iOS focus rejection", async () => {
    const focus = vi.fn().mockRejectedValue(new Error("inert client"));
    const navigate = vi.fn().mockResolvedValue({ focus });
    const w = worker([{ url: "https://hydropop.test/today", navigate, focus }]);
    const pending: Promise<unknown>[] = [];
    w.listeners.get("notificationclick")!({
      notification: {
        close: vi.fn(),
        data: { target: "/today?record=1&source=push" },
      },
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    });
    await Promise.all(pending);
    expect(navigate).toHaveBeenCalledWith(
      "https://hydropop.test/today?record=1&source=push",
    );
    expect(focus).toHaveBeenCalledOnce();
    expect(navigate.mock.invocationCallOrder[0]).toBeLessThan(
      focus.mock.invocationCallOrder[0]!,
    );
    expect(w.openWindow).not.toHaveBeenCalled();
  });
  it("falls back to opening a window when a suspended client cannot navigate", async () => {
    const w = worker([
      {
        url: "https://hydropop.test/today",
        navigate: vi.fn().mockRejectedValue(new Error("navigate failed")),
        focus: vi.fn(),
      },
    ]);
    const pending: Promise<unknown>[] = [];
    w.listeners.get("notificationclick")!({
      notification: {
        close: vi.fn(),
        data: { target: "/today?record=1&source=push" },
      },
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    });
    await Promise.all(pending);
    expect(w.openWindow).toHaveBeenCalledWith(
      "https://hydropop.test/today?record=1&source=push",
    );
  });
});
