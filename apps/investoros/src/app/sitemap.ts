import type { MetadataRoute } from "next";
import { getAllEsSlugs } from "@/lib/es-content";

/**
 * sitemap.ts — exposed at /sitemap.xml by Next.js.
 *
 * Includes the public marketing surface only — tenant dashboards and API
 * routes are blocked in robots.txt and omitted here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.investoros.tech";
  const lastModified = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                changeFrequency: "weekly", priority: 1.0,  lastModified },
    { url: `${baseUrl}/privacy`,   changeFrequency: "yearly", priority: 0.3,  lastModified },
    { url: `${baseUrl}/terms`,     changeFrequency: "yearly", priority: 0.3,  lastModified },
  ];

  const esPages: MetadataRoute.Sitemap = getAllEsSlugs().map((slug) => ({
    url: `${baseUrl}/es/${slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
    lastModified,
  }));

  return [...staticPages, ...esPages];
}
