"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { ActionSpinner } from "./action-feedback";
import {
  CalendarIcon,
  CommunityIcon,
  DeviceIcon,
  DropIcon,
  ProfileIcon,
  SettingsIcon,
  TrendsIcon,
  type IconProps,
} from "./icons";
import { useNavigationFeedback } from "./navigation-feedback";

type NavigationItem = {
  href: Route;
  label: string;
  icon: ComponentType<IconProps>;
};

const navigationItems: readonly NavigationItem[] = [
  { href: "/today", label: "Today", icon: DropIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/trends", label: "Trends", icon: TrendsIcon },
  { href: "/community", label: "Community", icon: CommunityIcon },
  { href: "/profile", label: "Profile", icon: ProfileIcon },
];

const secondaryNavigationItems: readonly NavigationItem[] = [
  { href: "/device", label: "Device", icon: DeviceIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function isActivePath(pathname: string, href: Route): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/community" && pathname.startsWith("/u/"))
  );
}

export function DesktopNavigation() {
  const pathname = usePathname();
  const { pendingHref } = useNavigationFeedback();

  return (
    <nav aria-label="Primary" className="mt-10 flex flex-col gap-2">
      {navigationItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const pending = pendingHref === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={pending ? `${item.label}, loading` : item.label}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              active
                ? "bg-brand-primary text-white shadow-lg shadow-[rgba(62,41,255,0.16)]"
                : "text-brand-secondary/60 hover:text-brand-secondary hover:bg-white"
            }`}
          >
            {pending ? (
              <ActionSpinner className="size-5" />
            ) : (
              <Icon className="size-5" />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DesktopSecondaryNavigation() {
  const pathname = usePathname();
  const { pendingHref } = useNavigationFeedback();

  return (
    <nav
      aria-label="Device and settings"
      className="border-brand-secondary/5 mt-6 grid grid-cols-2 gap-2 border-t pt-5"
    >
      {secondaryNavigationItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const pending = Boolean(pendingHref?.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={pending ? `${item.label}, loading` : item.label}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[0.65rem] font-semibold ${
              active
                ? "bg-brand-primary/10 text-brand-primary"
                : "text-brand-secondary/45 hover:bg-white"
            }`}
          >
            {pending ? (
              <ActionSpinner className="size-4" />
            ) : (
              <Icon className="size-4" />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const { pendingHref } = useNavigationFeedback();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-50 grid grid-cols-5 rounded-[1.6rem] border border-white/80 bg-white/90 p-1 shadow-[0_16px_50px_rgba(62,41,255,0.16)] backdrop-blur-xl md:hidden"
    >
      {navigationItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const pending = Boolean(pendingHref?.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={pending ? `${item.label}, loading` : item.label}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[0.58rem] font-semibold transition min-[360px]:text-[0.65rem] ${
              active
                ? "bg-brand-primary/10 text-brand-primary"
                : "text-brand-secondary/45"
            }`}
          >
            {pending ? (
              <ActionSpinner className="size-5" />
            ) : (
              <Icon className="size-5" />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
