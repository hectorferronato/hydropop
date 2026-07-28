"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import {
  CalendarIcon,
  DeviceIcon,
  DropIcon,
  SettingsIcon,
  type IconProps,
} from "./icons";

type NavigationItem = {
  href: Route;
  label: string;
  icon: ComponentType<IconProps>;
};

const navigationItems: readonly NavigationItem[] = [
  { href: "/today", label: "Today", icon: DropIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/device", label: "Device", icon: DeviceIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function isActivePath(pathname: string, href: Route): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="mt-10 flex flex-col gap-2">
      {navigationItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              active
                ? "bg-brand-primary text-white shadow-lg shadow-[rgba(62,41,255,0.16)]"
                : "text-brand-secondary/60 hover:text-brand-secondary hover:bg-white"
            }`}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-[1.6rem] border border-white/80 bg-white/90 p-1.5 shadow-[0_16px_50px_rgba(62,41,255,0.16)] backdrop-blur-xl md:hidden"
    >
      {navigationItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.65rem] font-semibold transition ${
              active
                ? "bg-brand-primary/10 text-brand-primary"
                : "text-brand-secondary/45"
            }`}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
