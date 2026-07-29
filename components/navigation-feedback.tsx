"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

type NavigationFeedbackValue = {
  pendingHref: string | null;
};

const NavigationFeedbackContext = createContext<NavigationFeedbackValue | null>(
  null,
);

function internalDestinationFromClick(
  event: MouseEvent<HTMLDivElement>,
): { anchor: HTMLAnchorElement; destination: string } | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }

  const target = event.target;
  const anchor =
    target instanceof Element
      ? target.closest<HTMLAnchorElement>("a[href]")
      : null;

  if (
    !anchor ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download")
  ) {
    return null;
  }

  const destination = new URL(anchor.href, window.location.href);

  if (destination.origin !== window.location.origin) {
    return null;
  }

  const current = `${window.location.pathname}${window.location.search}`;
  const next = `${destination.pathname}${destination.search}`;

  return current === next ? null : { anchor, destination: next };
}

export function NavigationFeedbackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const search = searchParameters.toString();
  const currentLocation = `${pathname}?${search}`;
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pendingAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const renderedLocationRef = useRef(currentLocation);
  const clearPendingAnchor = useCallback(() => {
    pendingAnchorRef.current?.removeAttribute("aria-busy");
    pendingAnchorRef.current?.removeAttribute("data-navigation-pending");
    pendingAnchorRef.current = null;
  }, []);

  useEffect(() => {
    if (renderedLocationRef.current === currentLocation) {
      return;
    }

    renderedLocationRef.current = currentLocation;
    const timeout = window.setTimeout(() => {
      clearPendingAnchor();
      setPendingHref(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [clearPendingAnchor, currentLocation]);

  useEffect(() => {
    if (!pendingHref) {
      return;
    }

    const timeout = window.setTimeout(() => {
      clearPendingAnchor();
      setPendingHref(null);
    }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [clearPendingAnchor, pendingHref]);

  useEffect(() => clearPendingAnchor, [clearPendingAnchor]);

  const value = useMemo(() => ({ pendingHref }), [pendingHref]);

  return (
    <NavigationFeedbackContext.Provider value={value}>
      <div
        aria-busy={pendingHref ? "true" : undefined}
        onClickCapture={(event) => {
          const pendingNavigation = internalDestinationFromClick(event);

          if (pendingNavigation) {
            clearPendingAnchor();
            pendingAnchorRef.current = pendingNavigation.anchor;
            pendingNavigation.anchor.setAttribute("aria-busy", "true");
            pendingNavigation.anchor.setAttribute(
              "data-navigation-pending",
              "true",
            );
            setPendingHref(pendingNavigation.destination);
          }
        }}
      >
        {pendingHref ? (
          <div
            role="status"
            aria-label="Loading page"
            className="bg-brand-primary/10 fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden"
          >
            <span className="bg-brand-primary block h-full w-1/3 animate-pulse rounded-r-full shadow-[0_0_12px_rgba(62,41,255,0.6)]" />
          </div>
        ) : null}
        {children}
      </div>
    </NavigationFeedbackContext.Provider>
  );
}

export function useNavigationFeedback(): NavigationFeedbackValue {
  return (
    useContext(NavigationFeedbackContext) ?? {
      pendingHref: null,
    }
  );
}
