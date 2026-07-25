import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HydroPOP",
    template: "%s · HydroPOP",
  },
  description: "A calm, personal hydration companion.",
  applicationName: "HydroPOP",
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
      <body>{children}</body>
    </html>
  );
}
