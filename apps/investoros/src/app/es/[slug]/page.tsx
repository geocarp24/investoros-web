// apps/investoros/src/app/es/[slug]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCCIONES PARA CLAUDE CODE:
//   1. Mover este archivo a: apps/investoros/src/app/es/[slug]/page.tsx
//   2. Instalar dependencias faltantes:
//        npm install gray-matter remark remark-html
//        npm install --save-dev @types/remark @types/remark-html
//   3. Los archivos .md van en: apps/investoros/content/es/[slug].md
//      (correr el script convert-es-pages.mjs para generarlos)
//   4. El componente AgentTeamSection está en:
//      apps/investoros/src/components/AgentTeamSection.tsx
//      (ya entregado en sesión anterior — asegúrate de que está en esa ruta)
// ─────────────────────────────────────────────────────────────────────────────

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import AgentTeamSection from '@/components/AgentTeamSection';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageFrontmatter {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  targetKeyword: string;
  searchVolumeTier: 'high' | 'medium' | 'low';
  hreflang: string;
}

interface EsPageProps {
  params: Promise<{ slug: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(process.cwd(), 'content', 'es');

function getPageData(slug: string): { frontmatter: PageFrontmatter; contentHtml: string } | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    frontmatter: data as PageFrontmatter,
    contentHtml: '', // filled async in component
  };
}

async function getPageDataAsync(slug: string) {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const processed = await remark()
    .use(remarkHtml, { sanitize: false })
    .process(content);

  return {
    frontmatter: data as PageFrontmatter,
    contentHtml: processed.toString(),
  };
}

// ─── generateStaticParams ─────────────────────────────────────────────────────

export async function generateStaticParams() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
  return files.map((f) => ({ slug: f.replace(/\.md$/, '') }));
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: EsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPageDataAsync(slug);
  if (!data) return { title: 'InvestorOS' };

  const { frontmatter } = data;
  const canonical = `https://investoros.tech/es/${frontmatter.slug}`;

  return {
    title: frontmatter.title,
    description: frontmatter.metaDescription,
    alternates: {
      canonical,
      languages: { es: canonical },
    },
    openGraph: {
      title: frontmatter.title,
      description: frontmatter.metaDescription,
      url: canonical,
      siteName: 'InvestorOS',
      type: 'article',
      locale: 'es_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: frontmatter.title,
      description: frontmatter.metaDescription,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// ─── JSON-LD Schema ────────────────────────────────────────────────────────────

function buildJsonLd(frontmatter: PageFrontmatter, slug: string): string {
  const url = `https://investoros.tech/es/${slug}`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: frontmatter.title,
        description: frontmatter.metaDescription,
        inLanguage: 'es',
        isPartOf: {
          '@type': 'WebSite',
          '@id': 'https://investoros.tech/#website',
          url: 'https://investoros.tech',
          name: 'InvestorOS',
        },
      },
      {
        '@type': 'Article',
        headline: frontmatter.h1,
        description: frontmatter.metaDescription,
        inLanguage: 'es',
        url,
        author: {
          '@type': 'Organization',
          name: 'InvestorOS',
          url: 'https://investoros.tech',
        },
        publisher: {
          '@type': 'Organization',
          name: 'InvestorOS',
          url: 'https://investoros.tech',
          logo: {
            '@type': 'ImageObject',
            url: 'https://investoros.tech/logo.png',
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://investoros.tech' },
          { '@type': 'ListItem', position: 2, name: 'Recursos', item: 'https://investoros.tech/es' },
          { '@type': 'ListItem', position: 3, name: frontmatter.h1, item: url },
        ],
      },
    ],
  });
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default async function EsSlugPage({ params }: EsPageProps) {
  const { slug } = await params;
  const data = await getPageDataAsync(slug);
  if (!data) notFound();

  const { frontmatter, contentHtml } = data;

  return (
    <>
      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(frontmatter, slug) }}
      />

      {/* Page wrapper — dark theme matching investoros.tech */}
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #07080d 0%, #0f1117 100%)',
          color: '#e2e8f0',
          fontFamily:
            "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* ── Hero / Header ── */}
        <header
          style={{
            maxWidth: 780,
            margin: '0 auto',
            padding: '80px 24px 48px',
            textAlign: 'center',
          }}
        >
          {/* Keyword pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 999,
              padding: '4px 14px',
              fontSize: 11,
              fontWeight: 600,
              color: '#818cf8',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 24,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#818cf8',
                display: 'inline-block',
              }}
            />
            {frontmatter.targetKeyword}
          </div>

          {/* H1 */}
          <h1
            style={{
              margin: '0 0 20px',
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #f8f8ff 0%, #a5b4fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {frontmatter.h1}
          </h1>

          {/* Meta description as lead */}
          <p
            style={{
              margin: '0 auto',
              maxWidth: 600,
              fontSize: 17,
              lineHeight: 1.65,
              color: '#94a3b8',
            }}
          >
            {frontmatter.metaDescription}
          </p>

          {/* CTA */}
          <div style={{ marginTop: 36 }}>
            <a
              href="https://investoros.tech/contacto"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                padding: '14px 32px',
                borderRadius: 10,
                textDecoration: 'none',
                boxShadow: '0 0 32px rgba(99,102,241,0.35)',
                transition: 'opacity 0.2s',
              }}
            >
              Solicita tu demo gratis →
            </a>
          </div>
        </header>

        {/* ── Article Body ── */}
        <article
          style={{
            maxWidth: 780,
            margin: '0 auto',
            padding: '0 24px 72px',
          }}
        >
          {/* Divider */}
          <div
            style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)',
              marginBottom: 56,
            }}
          />

          {/* Rendered markdown */}
          <div
            className="es-article-body"
            style={{
              fontSize: 16,
              lineHeight: 1.8,
              color: '#cbd5e1',
            }}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </article>

        {/* ── Agent Team Section ── */}
        <AgentTeamSection />

        {/* ── Footer CTA ── */}
        <section
          style={{
            maxWidth: 780,
            margin: '0 auto',
            padding: '0 24px 96px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(99,102,241,0.07)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 16,
              padding: '48px 32px',
            }}
          >
            <h2
              style={{
                margin: '0 0 12px',
                fontSize: 26,
                fontWeight: 700,
                color: '#f8f8ff',
                letterSpacing: '-0.01em',
              }}
            >
              Empieza hoy — sin riesgo
            </h2>
            <p
              style={{
                margin: '0 0 28px',
                fontSize: 15,
                color: '#64748b',
                lineHeight: 1.6,
              }}
            >
              Sin tarjeta de crédito. Sin contrato largo. Solo 30 minutos para ver
              <br />
              cómo InvestorOS puede transformar tu negocio.
            </p>
            <a
              href="https://investoros.tech/contacto"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                padding: '14px 32px',
                borderRadius: 10,
                textDecoration: 'none',
                boxShadow: '0 0 32px rgba(99,102,241,0.3)',
              }}
            >
              Solicita tu demo gratis →
            </a>
          </div>
        </section>
      </div>

      {/* ── Inline styles for article body markdown ── */}
      <style>{`
        .es-article-body h2 {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 48px 0 16px;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        .es-article-body h3 {
          font-size: 17px;
          font-weight: 600;
          color: #e2e8f0;
          margin: 32px 0 12px;
        }
        .es-article-body p {
          margin: 0 0 20px;
        }
        .es-article-body strong {
          color: #e2e8f0;
          font-weight: 600;
        }
        .es-article-body ul,
        .es-article-body ol {
          margin: 0 0 20px;
          padding-left: 24px;
        }
        .es-article-body li {
          margin-bottom: 8px;
        }
        .es-article-body em {
          color: #94a3b8;
          font-style: italic;
        }
        .es-article-body a {
          color: #818cf8;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .es-article-body a:hover {
          color: #a5b4fc;
        }
        .es-article-body blockquote {
          border-left: 3px solid rgba(99,102,241,0.5);
          margin: 24px 0;
          padding: 12px 20px;
          color: #94a3b8;
          background: rgba(99,102,241,0.05);
          border-radius: 0 8px 8px 0;
        }
        .es-article-body hr {
          border: none;
          border-top: 1px solid rgba(99,102,241,0.15);
          margin: 40px 0;
        }
      `}</style>
    </>
  );
}
