import type { MetadataRoute } from "next";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * sitemap.ts — exposed at /sitemap.xml by Next.js.
 *
 * Includes the public marketing surface only — tenant dashboards and API
 * routes are blocked in robots.txt and omitted here.
 *
 * The 30 ES slugs are read from content/es/*.md at build time, matching how
 * apps/investoros/src/app/es/[slug]/page.tsx discovers them.
 */
function getEsSlugs(): string[] {
  const dir = path.join(process.cwd(), "content", "es");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.investoros.tech";
  const lastModified = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,              changeFrequency: "weekly", priority: 1.0, lastModified },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3, lastModified },
    { url: `${baseUrl}/terms`,   changeFrequency: "yearly", priority: 0.3, lastModified },
  ];

  const esPages: MetadataRoute.Sitemap = getEsSlugs().map((slug) => ({
    url: `${baseUrl}/es/${slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
    lastModified,
  }));

  return [...staticPages, ...esPages];
}
