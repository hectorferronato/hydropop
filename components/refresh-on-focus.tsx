"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const duplicateFocusEventWindowMs = 1_000;

export function RefreshOnFocus() {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    function refreshVisiblePage() {
      if (document.visibilityState !== "visible") {
        return;
      }

      const now = Date.now();

      if (now - lastRefreshAtRef.current < duplicateFocusEventWindowMs) {
        return;
      }

      lastRefreshAtRef.current = now;
      router.refresh();
    }

    window.addEventListener("focus", refreshVisiblePage);
    document.addEventListener("visibilitychange", refreshVisiblePage);

    return () => {
      window.removeEventListener("focus", refreshVisiblePage);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
    };
  }, [router]);

  return null;
}
