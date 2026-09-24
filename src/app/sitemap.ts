import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// Only static pages. Per-address reports are dynamic and marked noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-09-24");
  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
