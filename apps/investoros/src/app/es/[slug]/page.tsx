/**
 * /es/[slug] — Spanish-language SEO pages.
 *
 * Statically generated at build time from src/content/es/pages.md
 * (30 pages authored by Cowork). Each page exposes hreflang alternates
 * pointing the EN side back to the homepage (until the EN versions ship).
 *
 * Rendered with react-markdown using the same .legal-prose typography
 * scope as /privacy and /terms — readable, brand-aligned, no extra deps.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getAllEsPages, getEsPage } from "@/lib/es-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllEsPages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getEsPage(slug);
  if (!page) return {};
  const url = `https://www.investoros.tech/es/${slug}`;
  return {
    title: page.title,
    description: page.metaDescription,
    alternates: {
      canonical: url,
      languages: {
        es: url,
        en: "https://www.investoros.tech",
        "x-default": "https://www.investoros.tech",
      },
    },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url,
      type: "article",
      locale: "es",
    },
  };
}

export default async function EsPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getEsPage(slug);
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-white text-[#0f172a]">
      <article className="legal-prose max-w-3xl mx-auto px-6 py-16">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#6366f1]">
          InvestorOS · ES
        </p>
        <h1>{page.h1}</h1>
        <ReactMarkdown>{page.body}</ReactMarkdown>
        <footer className="mt-16 pt-8 border-t border-black/10 text-sm text-[#64748b]">
          <p>
            <a
              href="/"
              className="text-[#6366f1] underline underline-offset-2"
              hrefLang="en"
            >
              English version ←
            </a>{" "}
            ·{" "}
            <a
              href="/privacy"
              className="text-[#6366f1] underline underline-offset-2"
            >
              Privacy
            </a>{" "}
            ·{" "}
            <a
              href="/terms"
              className="text-[#6366f1] underline underline-offset-2"
            >
              Terms
            </a>
          </p>
        </footer>
      </article>
    </main>
  );
}
