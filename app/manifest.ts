import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SNJ Pinterest — Wholesale Jewelry Discovery",
    short_name: "SNJ",
    description:
      "Mobile-first wholesale jewelry trend and product discovery. Swipe through new arrivals, save into client buckets.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf9f6",
    theme_color: "#faf9f6",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
