/**
 * Parser for the bundled Spanish-SEO content file.
 *
 * Source: src/content/es/pages.md — authored by Cowork. 30 pages separated by
 * `---` boundaries. Each page starts with a small frontmatter block
 * (key: value lines), then markdown body.
 *
 * Used by:
 *  - app/es/[slug]/page.tsx → generateStaticParams + page render
 *  - app/sitemap.ts → include all slugs in the sitemap
 *
 * Parse happens once per build (server-only, cached at module level).
 */
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

export type EsPageMeta = {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  targetKeyword?: string;
  searchVolumeTier?: string;
  hreflang?: string;
};

export type EsPage = EsPageMeta & {
  body: string; // raw markdown body (without frontmatter)
};

const FRONTMATTER_KEYS: Array<keyof EsPageMeta> = [
  "slug",
  "title",
  "metaDescription",
  "h1",
  "targetKeyword",
  "searchVolumeTier",
  "hreflang",
];

let cache: EsPage[] | null = null;

function parsePages(raw: string): EsPage[] {
  // Strip leading header comments (the first block before the first ---)
  const firstSeparator = raw.indexOf("\n---");
  const trimmed = firstSeparator > -1 ? raw.slice(firstSeparator + 1) : raw;

  // Split on standalone `---` lines. We want each page block which starts with
  // frontmatter key: value lines, followed by the markdown body.
  const blocks = trimmed
    .split(/^\s*---\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const pages: EsPage[] = [];

  for (const block of blocks) {
    // Frontmatter is the first contiguous run of `key: value` lines.
    const lines = block.split("\n");
    const meta: Partial<EsPageMeta> = {};
    let bodyStartIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^([a-zA-Z]+):\s*(.+)$/);
      if (match && FRONTMATTER_KEYS.includes(match[1] as keyof EsPageMeta)) {
        (meta as Record<string, string>)[match[1]] = match[2].trim();
        bodyStartIdx = i + 1;
      } else if (line.trim() === "") {
        // blank line — could be end of frontmatter; check next non-blank
        if (
          i + 1 < lines.length &&
          !/^[a-zA-Z]+:\s*.+$/.test(lines[i + 1]) &&
          Object.keys(meta).length > 0
        ) {
          bodyStartIdx = i + 1;
          break;
        }
      } else if (Object.keys(meta).length > 0) {
        bodyStartIdx = i;
        break;
      }
    }

    if (!meta.slug || !meta.title) continue;

    const body = lines.slice(bodyStartIdx).join("\n").trim();
    pages.push({
      slug: meta.slug,
      title: meta.title,
      metaDescription: meta.metaDescription ?? "",
      h1: meta.h1 ?? meta.title,
      targetKeyword: meta.targetKeyword,
      searchVolumeTier: meta.searchVolumeTier,
      hreflang: meta.hreflang ?? "es",
      body,
    });
  }

  return pages;
}

export function getAllEsPages(): EsPage[] {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "src", "content", "es", "pages.md");
  const raw = readFileSync(filePath, "utf8");
  cache = parsePages(raw);
  return cache;
}

export function getEsPage(slug: string): EsPage | undefined {
  return getAllEsPages().find((p) => p.slug === slug);
}

export function getAllEsSlugs(): string[] {
  return getAllEsPages().map((p) => p.slug);
}
