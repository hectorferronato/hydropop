import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

const sharedProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 1.8,
} as const;

export function DropIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <path d="M12 3.2S5.7 9.7 5.7 15a6.3 6.3 0 0 0 12.6 0C18.3 9.7 12 3.2 12 3.2Z" />
      <path d="M9.1 16.1a3.1 3.1 0 0 0 2.2 2.2" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <rect x="3.5" y="5.2" width="17" height="15" rx="2.4" />
      <path d="M7.5 3.5v3.4M16.5 3.5v3.4M3.5 9.3h17" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" />
    </svg>
  );
}

export function TrendsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
      <path d="m3.5 13 6-4 6 2 6-6" />
    </svg>
  );
}

export function CommunityIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <circle cx="8.3" cy="8.3" r="3" />
      <circle cx="16.8" cy="9.3" r="2.4" />
      <path d="M2.8 19c.5-3.4 2.3-5.2 5.5-5.2s5 1.8 5.5 5.2M14.2 14.7c.8-.6 1.7-.9 2.8-.9 2.5 0 3.9 1.4 4.2 4.2" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.7 20c.7-4.1 3.1-6.2 7.3-6.2s6.6 2.1 7.3 6.2" />
    </svg>
  );
}

export function DeviceIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <rect x="5.4" y="2.8" width="13.2" height="18.4" rx="3" />
      <path d="M9.2 6.3h5.6M9.5 17.7h5" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h10M18 18h2" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <path d="M10 4H5.8A1.8 1.8 0 0 0 4 5.8v12.4A1.8 1.8 0 0 0 5.8 20H10M14.5 8.5 18 12l-3.5 3.5M9 12h9" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...sharedProps} {...props}>
      <path d="M12 2.8c.6 4.8 2.4 6.6 7.2 7.2-4.8.6-6.6 2.4-7.2 7.2-.6-4.8-2.4-6.6-7.2-7.2 4.8-.6 6.6-2.4 7.2-7.2Z" />
      <path d="M18.5 16.2c.2 2 .9 2.7 2.9 2.9-2 .2-2.7.9-2.9 2.9-.2-2-.9-2.7-2.9-2.9 2-.2 2.7-.9 2.9-2.9Z" />
    </svg>
  );
}
