"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createVisibleRefreshController,
  type VisibleRefreshEnvironment,
} from "@/lib/application/refresh/visible-refresh-controller";

export function TodayRefreshController() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const environment: VisibleRefreshEnvironment = {
      addDocumentListener: (type, listener) =>
        document.addEventListener(type, listener),
      addWindowListener: (type, listener) =>
        window.addEventListener(type, listener),
      clearInterval: (timer) =>
        window.clearInterval(timer as ReturnType<typeof window.setInterval>),
      isOnline: () => navigator.onLine,
      isVisible: () => document.visibilityState === "visible",
      now: () => Date.now(),
      removeDocumentListener: (type, listener) =>
        document.removeEventListener(type, listener),
      removeWindowListener: (type, listener) =>
        window.removeEventListener(type, listener),
      setInterval: (listener, intervalMs) =>
        window.setInterval(listener, intervalMs),
    };
    const controller = createVisibleRefreshController({
      environment,
      refresh: async () => {
        const response = await fetch("/api/v1/dashboard/today", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        startTransition(() => router.refresh());
      },
    });

    controller.start();
    return controller.stop;
  }, [router]);

  return null;
}
