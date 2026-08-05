import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HydroPOP",
    short_name: "HydroPOP",
    description: "A calm, personal hydration companion.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#F7F8FC",
    theme_color: "#3E29FF",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/hydropop-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/hydropop-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
