import type { MetadataRoute } from "next";

/** Makes SFCode installable ("Add to Home screen" / "Install app"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SFCode: Salesforce practice",
    short_name: "SFCode",
    description: "Practise Apex, SOQL, LWC and Flow, and prepare for Salesforce certifications.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0284c7",
    categories: ["education", "developer"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Certification practice", url: "/certification", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Problems", url: "/problems", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Apex Playground", url: "/playground/apex", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
