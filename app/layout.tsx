import type { Metadata, Viewport } from "next";

import { PwaServiceWorker } from "@/components/pwa-service-worker";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HydroPOP",
    template: "%s · HydroPOP",
  },
  description: "A calm, personal hydration companion.",
  applicationName: "HydroPOP",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HydroPOP",
  },
  icons: {
    apple: "/icons/hydropop-icon-192.png",
    icon: "/icons/hydropop-icon-192.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f7f8fc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaServiceWorker />
      </body>
    </html>
  );
}
