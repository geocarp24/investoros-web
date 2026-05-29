import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "InvestorOS – Automatización para Contratistas Latinos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ── Slug → Title map ────────────────────────────────────────────────────────
const TITLE_MAP: Record<string, string> = {
  "software-para-contratistas-generales": "Software para Contratistas Generales",
  "automatizacion-de-negocios-de-construccion": "Automatización de Negocios de Construcción",
  "crm-para-contratistas-latinos": "CRM para Contratistas Latinos",
  "responder-leads-automaticamente-construccion": "Responder Leads Automáticamente",
  "software-para-remodelacion-de-banos": "Software para Remodelación de Baños",
  "software-para-remodelacion-de-cocinas": "Software para Remodelación de Cocinas",
  "gestion-de-clientes-para-carpinteros": "Gestión de Clientes para Carpinteros",
  "agentes-de-ia-para-negocios-de-construccion": "Agentes de IA para Construcción",
  "automatizar-seguimiento-de-clientes-contratistas": "Automatizar Seguimiento de Clientes",
  "software-para-constructores-en-wisconsin": "Software para Constructores en Wisconsin",
  "herramientas-digitales-para-contratistas-hispanos": "Herramientas para Contratistas Hispanos",
  "crm-para-negocios-de-remodelacion": "CRM para Negocios de Remodelación",
  "automatizar-publicaciones-en-redes-sociales-contratista": "Automatizar Redes Sociales",
  "responder-mensajes-de-clientes-automaticamente": "Responder Mensajes Automáticamente",
  "software-para-presupuestos-de-construccion": "Software para Presupuestos",
  "gestion-de-resenas-google-para-contratistas": "Gestión de Reseñas Google",
  "automatizacion-de-marketing-para-contratistas": "Automatización de Marketing",
  "plataforma-saas-para-negocios-de-construccion-latinos": "Plataforma SaaS para Latinos",
  "software-para-carpinteria-y-acabados": "Software para Carpintería y Acabados",
  "lead-management-para-contratistas-generales": "Lead Management para Contratistas",
  "notificaciones-automaticas-para-clientes-de-construccion": "Notificaciones Automáticas",
  "seguimiento-de-proyectos-de-remodelacion": "Seguimiento de Proyectos",
  "software-para-contratistas-en-texas": "Software para Contratistas en Texas",
  "software-para-contratistas-en-california": "Software para Contratistas en California",
  "software-para-contratistas-en-florida": "Software para Contratistas en Florida",
  "sistema-de-citas-para-contratistas-generales": "Sistema de Citas para Contratistas",
  "comunicacion-con-clientes-para-constructores": "Comunicación con Clientes",
  "herramientas-de-negocio-para-contratistas-pequenos": "Herramientas para Pequeños Negocios",
  "digitalizar-un-negocio-de-construccion": "Digitalizar tu Negocio de Construcción",
  "como-conseguir-mas-clientes-como-contratista": "Cómo Conseguir Más Clientes",
};

// ── Category detection ───────────────────────────────────────────────────────
type Category = "estado" | "servicio" | "marketing" | "software";

function getCategory(slug: string): Category {
  // Category B – Estado (state pages)
  const estadoSlugs = [
    "software-para-contratistas-en-texas",
    "software-para-contratistas-en-california",
    "software-para-contratistas-en-florida",
    "software-para-constructores-en-wisconsin",
  ];
  if (estadoSlugs.includes(slug)) return "estado";

  // Category C – Servicio específico
  const servicioKeywords = [
    "remodelacion-de-banos",
    "remodelacion-de-cocinas",
    "carpinteros",
    "carpinteria",
    "presupuestos",
  ];
  if (servicioKeywords.some((k) => slug.includes(k))) return "servicio";

  // Category D – Marketing / Redes
  const marketingKeywords = ["redes-sociales", "resenas-google", "marketing"];
  if (marketingKeywords.some((k) => slug.includes(k))) return "marketing";

  // Category A – Software / Automatización (default)
  return "software";
}

// ── Category metadata ────────────────────────────────────────────────────────
interface CategoryMeta {
  accent: string;       // hex color for accent bar & badge
  badgeLabel: string;   // short pill text
  icon: string;         // emoji icon
  tagline: string;      // bottom-left descriptor
}

const CATEGORY_META: Record<Category, CategoryMeta> = {
  software: {
    accent: "#6366f1",
    badgeLabel: "AUTOMATIZACIÓN",
    icon: "⚡",
    tagline: "Software & Automatización",
  },
  estado: {
    accent: "#10b981",
    badgeLabel: "POR ESTADO",
    icon: "📍",
    tagline: "Cobertura por Estado",
  },
  servicio: {
    accent: "#f59e0b",
    badgeLabel: "SERVICIO ESPECÍFICO",
    icon: "🔨",
    tagline: "Servicio Especializado",
  },
  marketing: {
    accent: "#ec4899",
    badgeLabel: "MARKETING",
    icon: "📣",
    tagline: "Marketing & Reputación",
  },
};

// ── Component ────────────────────────────────────────────────────────────────
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = TITLE_MAP[slug] ?? slug.replace(/-/g, " ");
  const category = getCategory(slug);
  const meta = CATEGORY_META[category];

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0f172a",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* ── Background grid dots (decorative) ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(99,102,241,0.12) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            display: "flex",
          }}
        />

        {/* ── Radial glow top-right ── */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${meta.accent}33 0%, transparent 70%)`,
            display: "flex",
          }}
        />

        {/* ── Left accent bar ── */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "6px",
            height: "100%",
            background: `linear-gradient(180deg, ${meta.accent} 0%, ${meta.accent}55 100%)`,
            display: "flex",
          }}
        />

        {/* ── Top row: logo + badge ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "44px 56px 0 56px",
          }}
        >
          {/* Logo wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: meta.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              {meta.icon}
            </div>
            <span
              style={{
                fontSize: "26px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.5px",
              }}
            >
              InvestorOS
            </span>
          </div>

          {/* Category badge */}
          <div
            style={{
              background: `${meta.accent}22`,
              border: `1.5px solid ${meta.accent}66`,
              borderRadius: "100px",
              padding: "6px 18px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <div
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: meta.accent,
                display: "flex",
              }}
            />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: meta.accent,
                letterSpacing: "1.2px",
              }}
            >
              {meta.badgeLabel}
            </span>
          </div>
        </div>

        {/* ── Main title ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 56px",
          }}
        >
          <div
            style={{
              fontSize: title.length > 35 ? "52px" : "62px",
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: "-1.5px",
              maxWidth: "900px",
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          <div
            style={{
              marginTop: "20px",
              fontSize: "22px",
              fontWeight: 400,
              color: "#94a3b8",
              letterSpacing: "0.2px",
            }}
          >
            Automatización para Contratistas Latinos
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 56px 44px 56px",
          }}
        >
          {/* Category tagline */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "2px",
                background: meta.accent,
                display: "flex",
              }}
            />
            <span
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: "#64748b",
                letterSpacing: "0.5px",
              }}
            >
              {meta.tagline}
            </span>
          </div>

          {/* Domain */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#475569",
              }}
            >
              investoros.tech
            </span>
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: meta.accent,
                display: "flex",
              }}
            />
          </div>
        </div>

        {/* ── Bottom accent line ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: `linear-gradient(90deg, ${meta.accent} 0%, ${meta.accent}00 60%)`,
            display: "flex",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
