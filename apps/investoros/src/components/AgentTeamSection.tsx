"use client";
/**
 * AgentTeamSection — Interactive 27-agent grid for /es/[slug] pages
 * Design: pixel-perfect match of investoros.tech landing page agent section
 *
 * Usage (in your /es/[slug]/page.tsx):
 *   import AgentTeamSection from "@/components/AgentTeamSection";
 *   ...
 *   <AgentTeamSection />
 *
 * Images: /investoros-agents/agent-SLUG.png (27 PNGs already in public/)
 * Deps: zero — only React + inline styles
 */

import React, { useState, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────────

type AgentStatus = "production" | "code-complete" | "planned";

interface Agent {
  name: string;
  slug: string;          // matches /investoros-agents/agent-{slug}.png
  role: string;
  description: string;
  status: AgentStatus;
  tech?: string;
}

const AGENTS: Agent[] = [
  // ── 🟢 PRODUCTION (12) ──────────────────────────────────
  {
    name: "Fer",
    slug: "fer",
    role: "AI Lead Receptionist",
    description:
      "Primera línea de contacto. Responde SMS en inglés y español, califica leads en tiempo real y agenda citas automáticamente — 24/7 sin descanso.",
    status: "production",
    tech: "SMS · OpenPhone · PHP/Hostinger",
  },
  {
    name: "Tracy",
    slug: "tracy",
    role: "Skip Tracer",
    description:
      "Encuentra datos de propietarios (nombre, teléfono, dirección) a partir de registros públicos y APIs especializadas. Convierte oportunidades en contactos calificados.",
    status: "production",
    tech: "Tracerfy API · owner lookup",
  },
  {
    name: "Marco",
    slug: "marco",
    role: "Social Media Manager",
    description:
      "Publica contenido bilingüe en Facebook e Instagram, gestiona el calendario editorial y mantiene la voz de marca consistente. Conectado directo a Meta Graph API.",
    status: "production",
    tech: "Meta Graph API · bilingual",
  },
  {
    name: "Sofia",
    slug: "sofia",
    role: "Visual Creator",
    description:
      "Genera imágenes para redes sociales — banners, before/after, promociones — usando plantillas HTML renderizadas a PNG y optimizadas con Cloudinary.",
    status: "production",
    tech: "HTML→PNG · Cloudinary",
  },
  {
    name: "Leo",
    slug: "leo",
    role: "Video Director",
    description:
      "Produce Reels de 15 segundos con avatares AI, voz sintética y edición automática. De guión a video publicado en minutos.",
    status: "production",
    tech: "FFmpeg · HeyGen · Reels 15s",
  },
  {
    name: "Max",
    slug: "max",
    role: "Quality Gate",
    description:
      "Revisa todo el contenido antes de publicar: cumplimiento de marca, coherencia de mensajes y eliminación de desperdicio. Nada sale sin su aprobación.",
    status: "production",
    tech: "brand compliance · anti-waste",
  },
  {
    name: "Nina",
    slug: "nina",
    role: "Content Optimizer",
    description:
      "Analiza el rendimiento del contenido y reescribe automáticamente las piezas de bajo rendimiento. Aprende de cada ciclo para mejorar continuamente.",
    status: "production",
    tech: "AI learning loop · rewrites",
  },
  {
    name: "Sage",
    slug: "sage",
    role: "Analytics",
    description:
      "Monitorea engagement en Facebook e Instagram, clasifica posts por tier de rendimiento y genera reportes accionables cada semana.",
    status: "production",
    tech: "FB+IG engagement · performance tiers",
  },
  {
    name: "Rex",
    slug: "rex",
    role: "SEO Monitor",
    description:
      "Audita posicionamiento local en 7 motores de búsqueda, mide Core Web Vitals y reporta caídas de ranking antes de que te cuesten clientes.",
    status: "production",
    tech: "geo-grid · CWV · 7 motores",
  },
  {
    name: "Ava",
    slug: "ava",
    role: "UX Optimizer",
    description:
      "Audita conversiones, velocidad de carga (LCP) y experiencia móvil. Identifica exactamente dónde los visitantes abandonan y cómo recuperarlos.",
    status: "production",
    tech: "LCP · CRO audit · mobile",
  },
  {
    name: "Echo",
    slug: "echo",
    role: "Meta Auditor",
    description:
      "Analiza la salud de tus cuentas de Facebook e Instagram: políticas, límites de gasto, errores de anuncios y riesgos de suspensión — bajo demanda.",
    status: "production",
    tech: "FB+IG account health · on-demand",
  },
  {
    name: "Zed",
    slug: "zed",
    role: "Dev Ops",
    description:
      "Convierte comandos de Telegram en commits de GitHub. Automatiza deploys, crea scripts y mantiene el VPS desde un chat — sin consola.",
    status: "production",
    tech: "Telegram→GitHub · Python · VPS",
  },

  // ── 🟡 CODE-COMPLETE (12) ───────────────────────────────
  {
    name: "Eli",
    slug: "eli",
    role: "SEO Content Writer",
    description:
      "Redacta páginas de servicio bilingües optimizadas para ciudades específicas. Estructura, schema markup y keywords — listo para publicar directamente en WordPress.",
    status: "code-complete",
    tech: "city pages · bilingual · WP",
  },
  {
    name: "Chase",
    slug: "chase",
    role: "Paid Ads Auditor",
    description:
      "Audita campañas de Google, Meta y TikTok Ads. Detecta presupuesto desperdiciado, audiencias mal segmentadas y creativos de bajo rendimiento.",
    status: "code-complete",
    tech: "Google/Meta/TikTok Ads",
  },
  {
    name: "Nova",
    slug: "nova",
    role: "GBP Manager",
    description:
      "Gestiona tu Google Business Profile: publica actualizaciones, responde reseñas y sube fotos automáticamente para mantener tu ficha activa y bien posicionada.",
    status: "code-complete",
    tech: "GBP posts · reviews · OAuth",
  },
  {
    name: "Kai",
    slug: "kai",
    role: "Lead Scorer",
    description:
      "Asigna un score 0–100 a cada lead y los enruta automáticamente: Hot va directo a llamada, Warm a seguimiento, Cold a nurture. Sin perder tiempo en leads fríos.",
    status: "code-complete",
    tech: "0-100 scoring · Hot/Warm/Cold",
  },
  {
    name: "Luca",
    slug: "luca",
    role: "LinkedIn B2B",
    description:
      "Prospección en LinkedIn dirigida a constructores, inversionistas y administradores de propiedades. Secuencias personalizadas basadas en ICP.",
    status: "code-complete",
    tech: "ICP targeting · B2B outreach",
  },
  {
    name: "Remi",
    slug: "remi",
    role: "Community Manager",
    description:
      "Participa en Reddit (r/HomeImprovement, r/Wisconsin) con respuestas útiles que generan awareness orgánico y tráfico cualificado sin publicidad.",
    status: "code-complete",
    tech: "Reddit · organic community",
  },
  {
    name: "Scout",
    slug: "scout",
    role: "Web Scraper",
    description:
      "Extrae oportunidades de foreclosures, probate y FSBO desde registros públicos. Alimenta el pipeline con leads de motivación alta antes que la competencia.",
    status: "code-complete",
    tech: "foreclosures · probate · FSBO",
  },
  {
    name: "Atlas",
    slug: "atlas",
    role: "Executive Brief",
    description:
      "Cada lunes a las 7am envía un resumen ejecutivo unificado de los 8 agentes principales: métricas clave, alertas activas y prioridades de la semana.",
    status: "code-complete",
    tech: "Monday 7am · 8 agents · digest",
  },
  {
    name: "Orion",
    slug: "orion",
    role: "System Watchdog",
    description:
      "Monitorea la salud de todos los agentes, detecta fallos y activa auto-reparación. Evoluciona semanalmente incorporando las lecciones aprendidas.",
    status: "code-complete",
    tech: "self-repair · weekly evolution",
  },
  {
    name: "Viper",
    slug: "viper",
    role: "Sales Closer",
    description:
      "Monitorea precios de competidores en tiempo real y genera argumentos de cierre basados en diferencias concretas. Convierte objeciones en ventas.",
    status: "code-complete",
    tech: "competitor prices · objections",
  },
  {
    name: "Ember",
    slug: "ember",
    role: "Onboarding",
    description:
      "Secuencias de email de bienvenida, configuración de SPF/DKIM y gestión de listas. Convierte nuevos contactos en clientes recurrentes desde el primer mensaje.",
    status: "code-complete",
    tech: "email marketing · SMTP · SPF/DKIM",
  },
  {
    name: "Flynn",
    slug: "flynn",
    role: "Automation Builder",
    description:
      "Crea flujos de trabajo en Make.com conectando tus herramientas. Elimina tareas manuales repetitivas sin necesidad de programar.",
    status: "code-complete",
    tech: "Make.com · no-code workflows",
  },

  // ── 🔵 PLANNED (3) ──────────────────────────────────────
  {
    name: "Carto",
    slug: "carto",
    role: "Territory Mapping",
    description:
      "Visualiza tu cobertura geográfica, identifica zonas sin presencia y optimiza rutas de servicio para maximizar el radio de operación.",
    status: "planned",
    tech: "geo coverage · territory",
  },
  {
    name: "Ward",
    slug: "ward",
    role: "Compliance & Risk",
    description:
      "Verifica cumplimiento de TCPA, CAN-SPAM y ADA en todas las comunicaciones. Protege el negocio de sanciones antes de que ocurran.",
    status: "planned",
    tech: "TCPA · CAN-SPAM · ADA",
  },
  {
    name: "Penny",
    slug: "penny",
    role: "Financial Intelligence",
    description:
      "Analiza ingresos de Stripe, proyecta flujo de caja y genera reportes financieros automáticos. Tus números, siempre actualizados.",
    status: "planned",
    tech: "Stripe · billing · forecasting",
  },
];

// ─────────────────────────────────────────────────────────────
//  STATUS CONFIG  (colors match landing page exactly)
// ─────────────────────────────────────────────────────────────

const STATUS = {
  production: {
    label: "En producción",
    shortLabel: "Live",
    color: "#22c55e",            // rgb(34,197,94)
    borderAlpha: "rgba(34,197,94,0.5)",
    glow: "rgba(34,197,94,0.18)",
    badgeBg: "rgba(34,197,94,0.12)",
    badgeText: "#22c55e",
    pageBg: "#09090f",           // border of status dot — must match section bg
  },
  "code-complete": {
    label: "Listo para deploy",
    shortLabel: "Ready",
    color: "#f59e0b",            // rgb(245,158,11)
    borderAlpha: "rgba(245,158,11,0.5)",
    glow: "rgba(245,158,11,0.18)",
    badgeBg: "rgba(245,158,11,0.12)",
    badgeText: "#f59e0b",
    pageBg: "#09090f",
  },
  planned: {
    label: "Próximamente",
    shortLabel: "Soon",
    color: "#6366f1",            // rgb(99,102,241)
    borderAlpha: "rgba(99,102,241,0.5)",
    glow: "rgba(99,102,241,0.18)",
    badgeBg: "rgba(99,102,241,0.12)",
    badgeText: "#6366f1",
    pageBg: "#09090f",
  },
} as const;

// ─────────────────────────────────────────────────────────────
//  AGENT CARD  (pixel-perfect: 72px circle, absolute status dot,
//               11px name, 10px role — matches landing page)
// ─────────────────────────────────────────────────────────────

interface CardProps {
  agent: Agent;
  onClick: (a: Agent) => void;
}

function AgentCard({ agent, onClick }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const sc = STATUS[agent.status];

  return (
    <button
      onClick={() => onClick(agent)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`Ver detalles de ${agent.name} — ${agent.role}`}
      style={{
        // Reset
        all: "unset",
        cursor: "pointer",
        // Layout — identical to landing page agentCard
        display: "block",
        textAlign: "center",
        // Subtle hover lift only (no border/bg like landing page)
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "transform 0.22s ease",
        outline: "none",
      }}
    >
      {/* ── Avatar wrapper: 72×72, position:relative (landing exact) ── */}
      <span
        style={{
          display: "inline-block",
          position: "relative",
          width: 72,
          height: 72,
        }}
      >
        {/* Portrait */}
        {imgError ? (
          // Fallback: coloured circle with initial
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: sc.glow,
              border: `2px solid ${sc.borderAlpha}`,
              fontSize: 28,
              fontWeight: 700,
              color: sc.color,
            }}
          >
            {agent.name[0]}
          </span>
        ) : (
          <img
            src={`/investoros-agents/agent-${agent.slug}.png`}
            alt={agent.name}
            width={72}
            height={72}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
              // Border color = status color at 0.5 opacity (landing exact)
              border: `2px solid ${hovered ? sc.color : sc.borderAlpha}`,
              transition: "border-color 0.22s ease, box-shadow 0.22s ease",
              boxShadow: hovered ? `0 0 18px ${sc.glow}` : "none",
            }}
          />
        )}

        {/* ── Status dot: 14×14, absolute bottom:0 right:0 (landing exact) ── */}
        <span
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: sc.color,
            // 2px solid border matching page bg — hides bleed onto avatar
            border: `2px solid #09090f`,
            boxShadow: `0 0 6px ${sc.color}`,
          }}
        />
      </span>

      {/* ── Name: 11px / 600 / #f8f8ff, marginTop:6px (landing exact) ── */}
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 11,
          fontWeight: 600,
          color: "#f8f8ff",          // rgb(248,248,255)
          lineHeight: 1.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 80,
        }}
      >
        {agent.name}
      </p>

      {/* ── Role: 10px / #64748b (landing exact) ── */}
      <p
        style={{
          margin: "2px 0 0",
          fontSize: 10,
          color: "#64748b",          // rgb(100,116,139)
          lineHeight: 1.3,
          maxWidth: 80,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {agent.role}
      </p>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────────────────────────

interface ModalProps {
  agent: Agent | null;
  onClose: () => void;
}

function AgentModal({ agent, onClose }: ModalProps) {
  const [imgError, setImgError] = useState(false);

  // Close on ESC
  useEffect(() => {
    if (!agent) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [agent, onClose]);

  // Reset img error when agent changes
  useEffect(() => { setImgError(false); }, [agent?.slug]);

  if (!agent) return null;
  const sc = STATUS[agent.status];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        animation: "ats-fadeIn 0.15s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f1117",
          border: `1px solid ${sc.borderAlpha}`,
          borderRadius: "1.25rem",
          maxWidth: 440,
          width: "100%",
          padding: "2rem",
          boxShadow: `0 0 50px ${sc.glow}, 0 25px 60px rgba(0,0,0,0.7)`,
          animation: "ats-slideUp 0.22s ease both",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "50%",
            width: 32,
            height: 32,
            color: "#9ca3af",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.13)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)")
          }
        >
          ×
        </button>

        {/* Portrait + name row */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {imgError ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  background: sc.glow,
                  border: `2px solid ${sc.borderAlpha}`,
                  fontSize: 36,
                  fontWeight: 700,
                  color: sc.color,
                }}
              >
                {agent.name[0]}
              </span>
            ) : (
              <img
                src={`/investoros-agents/agent-${agent.slug}.png`}
                alt={agent.name}
                width={88}
                height={88}
                onError={() => setImgError(true)}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `2px solid ${sc.borderAlpha}`,
                  boxShadow: `0 0 24px ${sc.glow}`,
                  display: "block",
                }}
              />
            )}
            {/* Status dot */}
            <span
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: sc.color,
                border: "2px solid #0f1117",
                boxShadow: `0 0 8px ${sc.color}`,
              }}
            />
          </div>

          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "#f9fafb",
                lineHeight: 1.2,
              }}
            >
              {agent.name}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.82rem", color: "#9ca3af" }}>
              {agent.role}
            </p>
            {/* Status badge */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginTop: "0.5rem",
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                background: sc.badgeBg,
                color: sc.badgeText,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: sc.color,
                  boxShadow: `0 0 5px ${sc.color}`,
                }}
              />
              {sc.label.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            margin: "0 0 1.1rem",
            fontSize: "0.88rem",
            lineHeight: 1.7,
            color: "#d1d5db",
          }}
        >
          {agent.description}
        </p>

        {/* Tech pills */}
        {agent.tech && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "1.5rem" }}>
            {agent.tech.split(" · ").map((t) => (
              <span
                key={t}
                style={{
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: "0.7rem",
                  fontWeight: 500,
                  background: "rgba(255,255,255,0.05)",
                  color: "#94a3b8",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <a
          href="https://investoros.tech/#pricing"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            textAlign: "center",
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.875rem",
            textDecoration: "none",
            transition: "opacity 0.2s, transform 0.2s",
            letterSpacing: "0.01em",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.88";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          Activar {agent.name} en mi negocio →
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  LEGEND DOT  (matches agentsLegend on landing page)
// ─────────────────────────────────────────────────────────────

interface LegendItemProps {
  color: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function LegendItem({ color, label, count, active, onClick }: LegendItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        // Match landing agentsLegend fontSize:12px exactly
        fontSize: 12,
        color: active ? "#e2e8f0" : "#64748b",
        transition: "color 0.18s",
        padding: "4px 10px",
        borderRadius: 999,
        background: active ? "rgba(255,255,255,0.07)" : "transparent",
        border: `1px solid ${active ? "rgba(255,255,255,0.12)" : "transparent"}`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          boxShadow: active ? `0 0 6px ${color}` : "none",
        }}
      />
      {label}
      <span
        style={{
          marginLeft: 2,
          padding: "1px 6px",
          borderRadius: 999,
          fontSize: 10,
          background: "rgba(255,255,255,0.07)",
          color: "#94a3b8",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────────────────────

type FilterValue = "all" | AgentStatus;

export default function AgentTeamSection() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selected, setSelected] = useState<Agent | null>(null);
  const handleClose = useCallback(() => setSelected(null), []);

  const filtered = filter === "all" ? AGENTS : AGENTS.filter((a) => a.status === filter);

  const counts = {
    all: AGENTS.length,
    production: AGENTS.filter((a) => a.status === "production").length,
    "code-complete": AGENTS.filter((a) => a.status === "code-complete").length,
    planned: AGENTS.filter((a) => a.status === "planned").length,
  };

  return (
    <>
      {/* ── Keyframes ───────────────────────────────────────────── */}
      <style>{`
        @keyframes ats-fadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes ats-slideUp {
          from { transform: translateY(24px); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }
      `}</style>

      {/* ── Section wrapper ─────────────────────────────────────── */}
      <section
        style={{
          // Matches landing page section background
          background: "linear-gradient(180deg, #07080d 0%, #0f1117 100%)",
          padding: "5rem 1.5rem",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#f8f8ff",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>

          {/* ── Header ──────────────────────────────────────────── */}
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            {/* Eye-brow pill */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "4px 14px",
                borderRadius: 999,
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.28)",
                fontSize: 11,
                fontWeight: 700,
                color: "#a5b4fc",
                letterSpacing: "0.09em",
                marginBottom: "1.1rem",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#6366f1",
                  boxShadow: "0 0 6px #6366f1",
                }}
              />
              POWERED BY INVESTOROS
            </div>

            {/* Title */}
            <h2
              style={{
                margin: "0 0 0.75rem",
                fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #f9fafb 30%, #94a3b8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Tu equipo de 27 agentes AI
            </h2>

            {/* Subtitle */}
            <p
              style={{
                margin: "0 auto",
                maxWidth: 500,
                fontSize: "0.95rem",
                color: "#64748b",
                lineHeight: 1.65,
              }}
            >
              Cada agente trabaja las 24 horas, los 7 días de la semana.
              Haz clic en cualquiera para conocerlo.
            </p>
          </div>

          {/* ── Legend / Filter (matches agentsLegend on landing) ── */}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: "2.25rem",
            }}
          >
            <LegendItem
              color="#ffffff"
              label="Todos"
              count={counts.all}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <LegendItem
              color={STATUS.production.color}
              label="En producción"
              count={counts.production}
              active={filter === "production"}
              onClick={() => setFilter("production")}
            />
            <LegendItem
              color={STATUS["code-complete"].color}
              label="Listos para deploy"
              count={counts["code-complete"]}
              active={filter === "code-complete"}
              onClick={() => setFilter("code-complete")}
            />
            <LegendItem
              color={STATUS.planned.color}
              label="Próximamente"
              count={counts.planned}
              active={filter === "planned"}
              onClick={() => setFilter("planned")}
            />
          </div>

          {/* ── Agent grid ──────────────────────────────────────── */}
          {/* Landing page: gap:12px, repeat(9, ~111px) on desktop   */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map((agent) => (
              <AgentCard key={agent.slug} agent={agent} onClick={setSelected} />
            ))}
          </div>

          {/* ── Stats bar ───────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              gap: "2.5rem",
              justifyContent: "center",
              flexWrap: "wrap",
              marginTop: "3rem",
              paddingTop: "2.25rem",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {[
              { value: "12", label: "Agentes en producción", color: STATUS.production.color },
              { value: "12", label: "Listos para activar",   color: STATUS["code-complete"].color },
              { value: "3",  label: "En desarrollo",          color: STATUS.planned.color },
              { value: "24/7", label: "Operación continua",   color: "#f8f8ff" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.9rem",
                    fontWeight: 800,
                    color: s.color,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 3 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Modal ───────────────────────────────────────────────── */}
      {selected && <AgentModal agent={selected} onClose={handleClose} />}
    </>
  );
}
