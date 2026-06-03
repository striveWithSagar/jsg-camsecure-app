import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "JSG CamSecure",
    short_name:       "JSG",
    description:      "Field service operations — camera and security installation",
    start_url:        "/",
    display:          "standalone",
    orientation:      "portrait-primary",
    background_color: "#0d1b2a",
    theme_color:      "#F27622",
    categories:       ["business", "productivity"],
    icons: [
      {
        src:     "/icons/icon-192.png",
        sizes:   "192x192",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "any",
      },
      {
        src:     "/icons/icon-maskable-512.png",
        sizes:   "512x512",
        type:    "image/png",
        purpose: "maskable",
      },
      // Fallback: existing logo for any size
      {
        src:     "/brand/jsg-camsecure-logo.png",
        sizes:   "any",
        type:    "image/png",
        purpose: "any",
      },
    ],
  };
}
