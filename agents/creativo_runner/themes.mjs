// Pinnacle Holdings — 5 brand themes + slide HTML builders.
// Target: Instagram 4:5 portrait = 1080 x 1350 (mobile-native).
// Each builder returns BODY-only HTML (open-carrusel's wrapSlideHtml injects <html>/<head>/fonts).

const LOGO_URL = "https://pinnaclegroupwi.com/wp-content/uploads/2026/03/logo-pinnacle.png";
const PHONE    = "(920) 777-9886";
const WEBSITE  = "pinnaclegroupwi.com";
const FONT_HEADING = "Montserrat";
const FONT_BODY    = "Montserrat";

export const THEMES = {
  T1: { name: "Dark Premium",  bg: "#0D3B2E", text: "#FFFFFF", accent: "#C9A84C", muted: "#E6E1D2", subtle: "rgba(255,255,255,.12)" },
  T2: { name: "White Clean",   bg: "#FFFFFF", text: "#0D3B2E", accent: "#C9A84C", muted: "#5A6B65", subtle: "rgba(13,59,46,.08)"  },
  T3: { name: "Gold & Black",  bg: "#1A1A1A", text: "#FFFFFF", accent: "#C9A84C", muted: "#C2C2C2", subtle: "rgba(201,168,76,.16)"},
  T4: { name: "Soft Cream",    bg: "#F5F0E8", text: "#0D3B2E", accent: "#C9A84C", muted: "#2C2C2C", subtle: "rgba(13,59,46,.08)"  },
  T5: { name: "Vibrant Blue",  bg: "#1B2A8C", text: "#FFFFFF", accent: "#FF2D78", muted: "#9BB3FF", subtle: "rgba(255,255,255,.14)", accent2: "#00E676" },
};

export const VALID_THEME_CODES = Object.keys(THEMES);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" })[c]);
}

function baseWrapper(theme, inner, opts = {}) {
  const pad = opts.pad ?? 72;
  return `<div style="
    width:1080px; height:1350px; background:${theme.bg}; color:${theme.text};
    font-family:'${FONT_HEADING}', system-ui, sans-serif;
    padding:${pad}px; position:relative; display:flex; flex-direction:column; overflow:hidden;">
    ${inner}
  </div>`;
}

function logoWatermark(theme, size = 220) {
  // Logo Pinnacle es 677×369 (rectangular). Tamaño visible: 220px width = ~120px height.
  return `<img src="${LOGO_URL}" alt="Pinnacle Holdings" style="
    position:absolute; bottom:56px; right:56px; width:${size}px; height:auto;
    opacity:${theme.name === "White Clean" || theme.name === "Soft Cream" ? "1" : "1"};
    filter:${theme.name === "White Clean" || theme.name === "Soft Cream" ? "none" : "drop-shadow(0 2px 6px rgba(0,0,0,.25))"};" />`;
}

// ---------------------------------------------------------------------------
// HOOK SLIDE — large centered hook text, bilingual EN/ES, logo watermark
// Used as Slide 1 of every carousel/post.
// ---------------------------------------------------------------------------
export function slideHook(themeCode, { hookEn, hookEs, badge } = {}) {
  const theme = THEMES[themeCode] || THEMES.T1;
  const badgeChip = badge ? `
    <div style="
      align-self:center;
      background:${theme.accent};
      color:${theme.bg};
      font-size:22px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
      padding:10px 22px; border-radius:999px; margin-bottom:36px;">
      ${esc(badge)}
    </div>` : "";

  const inner = `
    <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:32px;">
      ${badgeChip}
      <h1 style="
        font-size:104px; font-weight:800; line-height:1.05; letter-spacing:-0.02em;
        color:${theme.text}; max-width:920px;">
        ${esc(hookEn || "")}
      </h1>
      ${hookEs ? `<p style="
        font-size:44px; font-weight:500; line-height:1.25;
        color:${theme.accent}; max-width:900px; margin-top:12px;">
        ${esc(hookEs)}
      </p>` : ""}
      <div style="margin-top:48px; width:96px; height:4px; background:${theme.accent}; border-radius:4px;"></div>
    </div>
    ${logoWatermark(theme, 240)}
  `;
  return baseWrapper(theme, inner);
}

// ---------------------------------------------------------------------------
// POINT SLIDE — numbered body point with heading + body text, logo small
// Used as Slides 2 through N-1.
// ---------------------------------------------------------------------------
export function slidePoint(themeCode, { index, total, headingEn, bodyEs, headingEs, bodyEn } = {}) {
  const theme = THEMES[themeCode] || THEMES.T1;
  const numColor = theme.bg;  // number shown ON accent-color circle
  const heading = headingEs || headingEn || "";
  const body    = bodyEn || bodyEs || "";

  const inner = `
    <div style="display:flex; align-items:center; gap:24px; margin-bottom:48px;">
      <div style="
        width:96px; height:96px; border-radius:50%;
        background:${theme.accent}; color:${numColor};
        display:flex; align-items:center; justify-content:center;
        font-size:52px; font-weight:800; line-height:1;">
        ${esc(index ?? "1")}
      </div>
      <div style="
        flex:1; font-size:24px; color:${theme.muted};
        font-weight:500; letter-spacing:.06em; text-transform:uppercase;">
        Punto ${esc(index ?? "1")} / ${esc(total ?? "5")}
      </div>
    </div>

    <h2 style="
      font-size:78px; font-weight:800; line-height:1.12; letter-spacing:-0.015em;
      color:${theme.text}; margin-bottom:36px;">
      ${esc(heading)}
    </h2>

    <div style="width:72px; height:4px; background:${theme.accent}; border-radius:4px; margin-bottom:36px;"></div>

    <p style="
      font-size:40px; font-weight:400; line-height:1.45;
      color:${theme.muted};">
      ${esc(body)}
    </p>

    ${logoWatermark(theme, 200)}
  `;
  return baseWrapper(theme, inner);
}

// ---------------------------------------------------------------------------
// CTA SLIDE — centered logo + call to action + phone + website
// Used as the last slide of every carousel/post.
// ---------------------------------------------------------------------------
export function slideCTA(themeCode, { ctaEn, ctaEs } = {}) {
  const theme = THEMES[themeCode] || THEMES.T1;
  const cta_en = ctaEn || "We Buy Houses — Cash. Fast. Fair.";
  const cta_es = ctaEs || "Compramos Casas — Efectivo. Rápido. Justo.";

  const inner = `
    <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:36px;">
      <img src="${LOGO_URL}" alt="Pinnacle Holdings" style="width:520px; height:auto; margin-bottom:24px;" />

      <h2 style="
        font-size:62px; font-weight:800; line-height:1.1; letter-spacing:-0.015em;
        color:${theme.text}; max-width:900px;">
        ${esc(cta_en)}
      </h2>
      <p style="
        font-size:34px; font-weight:500; line-height:1.3;
        color:${theme.accent}; max-width:900px;">
        ${esc(cta_es)}
      </p>

      <div style="width:96px; height:4px; background:${theme.accent}; border-radius:4px; margin:12px 0;"></div>

      <div style="display:flex; flex-direction:column; align-items:center; gap:14px; margin-top:20px;">
        <div style="font-size:52px; font-weight:800; color:${theme.text}; letter-spacing:-0.01em;">
          ${PHONE}
        </div>
        <div style="font-size:32px; font-weight:500; color:${theme.muted};">
          ${WEBSITE}
        </div>
      </div>
    </div>
  `;
  return baseWrapper(theme, inner, { pad: 96 });
}

// ---------------------------------------------------------------------------
// POST EDITORIAL SLIDE — single-frame editorial post with photo background.
// Designed for "asombroso" Pinnacle posts (Jorge 2026-05-07): Pexels/stock
// photo background + Pinnacle dark-green dim layer + bold hook + CTA + brand.
//
// Aesthetic alignment (CLAUDE.md regla 1e — homeowner editorial, NOT tech):
//   - impeccable: production-grade typography, hierarchy, mobile-first 1080×1350
//   - minimalist-ui: editorial monochrome warmth, NO gradients on text
//   - high-end-visual-design: heavy shadows, golden accent, premium feel
//   - emil-design-eng: taste — generous spacing, deliberate imperfection
//
// Layout (top → bottom):
//   • Logo top-left (140px wide, drop-shadow)
//   • Optional badge top-right (pill chip)
//   • Hero hookEn — large 92pt bold white, max 4 lines, vertical-center weighted
//   • Gold accent bar (96×4) + hookEs in accent color, smaller (40pt)
//   • Bottom block: phone (52pt bold) + website (28pt) on dim band
//   • Photographer credit micro-footer (12pt rgba .35)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// POST EDITORIAL SLIDE — single-frame editorial post with photo background.
//
// MONO-LANGUAGE (Jorge 2026-05-07): each record is single-language. Template
// renders ONE hook + optional supporting subtitle + ONE CTA, all in the
// record's language (ES or EN). No bilingual mixing on the same image.
//
// Aesthetic skills (CLAUDE.md regla 1e — Pinnacle homeowner editorial):
//   - impeccable: production typography, hierarchy, mobile-first 1080×1350
//   - minimalist-ui: editorial monochrome warmth, NO gradients on text
//   - high-end-visual-design: heavy shadows, golden accent, premium feel
//   - emil-design-eng: taste — generous spacing, deliberate imperfection
//
// Layout (top → bottom):
//   • Logo top-left (540px wide, drop-shadow)
//   • Optional badge top-right (pill chip)
//   • Hero hook — big 92pt bold, vertical-center weighted (record's language only)
//   • Gold accent bar + optional supporting subtitle in Pinnacle fuchsia
//   • Bottom block: phone (54pt bold) + website on dim band
//   • Photographer credit micro-footer
// ---------------------------------------------------------------------------
export function slidePostEditorial(themeCode, opts = {}) {
  const theme = THEMES[themeCode] || THEMES.T1;
  // Backward-compat: accept legacy hookEn/hookEs but auto-pick by lang.
  // New callers pass single `hook` + optional `subtitle` + `cta` + `lang`.
  const { hook, subtitle, cta, lang, bgUrl, photographer, badge,
          hookEn, hookEs, ctaEs } = opts;

  // Theme-specific dim layer.
  const isLightTheme = themeCode === "T2" || themeCode === "T4";
  const dimBg     = isLightTheme ? "rgba(255,255,255,0.92)" : `${theme.bg}EC`;
  const dimMidBg  = isLightTheme ? "rgba(255,255,255,0.35)" : `${theme.bg}66`;
  const heroColor = isLightTheme ? theme.text : "#FFFFFF";
  const muteColor = isLightTheme ? theme.muted : "rgba(255,255,255,0.85)";

  // Resolve mono-language hook + subtitle + cta. Prefer the new `hook`/`subtitle`
  // params; fall back to legacy hookEn/hookEs based on `lang` if those are passed.
  const langCode = String(lang || "ES").toUpperCase();
  let heroText = (hook || "").trim();
  let subText  = (subtitle || "").trim();
  if (!heroText) {
    // Legacy compat — pick the hook field matching the record's language.
    heroText = langCode === "EN"
      ? (hookEn || "").trim() || (hookEs || "").trim()
      : (hookEs || "").trim() || (hookEn || "").trim();
  }
  if (!heroText) heroText = langCode === "EN" ? "Cash for Your House." : "Compramos Tu Casa.";

  const ctaText = (cta || ctaEs || "").trim() ||
    (langCode === "EN" ? "Cash. Fast. Fair. Call (920) 777-9886"
                       : "Efectivo. Rápido. Justo. (920) 777-9886");

  const safeBgUrl = bgUrl || "https://images.pexels.com/photos/277667/pexels-photo-277667.jpeg?auto=compress&w=1080&h=1350&fit=crop";

  const badgeChip = badge ? `
    <div style="
      position:absolute; top:64px; right:64px;
      background:${theme.accent}; color:${theme.bg};
      font-size:18px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
      padding:10px 20px; border-radius:999px;
      box-shadow:0 4px 18px rgba(0,0,0,.25);">
      ${esc(badge)}
    </div>` : "";

  const photographerCredit = photographer ? `
    <div style="
      position:absolute; bottom:18px; left:24px;
      font-size:13px; color:rgba(255,255,255,0.42);
      font-weight:500; letter-spacing:.04em;">
      Photo · ${esc(photographer)}
    </div>` : "";

  return `<div style="
    width:1080px; height:1350px; position:relative; overflow:hidden;
    background:${theme.bg}; font-family:'${FONT_HEADING}', system-ui, sans-serif;">

    <img src="${safeBgUrl}" alt="" style="
      position:absolute; top:0; left:0; width:100%; height:100%;
      object-fit:cover; z-index:1;" />

    <div style="
      position:absolute; top:0; left:0; width:100%; height:50%;
      background:linear-gradient(to bottom, ${dimBg} 0%, ${dimMidBg} 60%, transparent 100%);
      z-index:2;"></div>

    <div style="
      position:absolute; bottom:0; left:0; width:100%; height:46%;
      background:linear-gradient(to top, ${dimBg} 35%, ${dimMidBg} 75%, transparent 100%);
      z-index:2;"></div>

    <div style="
      position:absolute; top:0; left:0; width:100%; height:100%;
      background:radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.22) 100%);
      z-index:3; pointer-events:none;"></div>

    <img src="${LOGO_URL}" alt="Pinnacle Holdings" style="
      position:absolute; top:64px; left:64px; width:540px; height:auto;
      filter:drop-shadow(0 6px 22px rgba(0,0,0,.55));
      z-index:5;" />
    ${badgeChip}

    <!-- Hero hook (mono-language, record's lang only) -->
    <div style="
      position:absolute; top:460px; left:72px; right:72px;
      z-index:6; display:flex; flex-direction:column; gap:28px;">
      <h1 style="
        margin:0; font-size:92px; font-weight:900; line-height:1.02;
        letter-spacing:-0.025em; color:${heroColor};
        text-shadow:0 4px 28px rgba(0,0,0,0.55);">
        ${esc(heroText)}
      </h1>
      <div style="width:104px; height:5px; background:${theme.accent}; border-radius:4px;"></div>
      ${subText ? `<p style="
        margin:0; font-size:38px; font-weight:600; line-height:1.22;
        color:#FF1493; letter-spacing:-0.005em;
        text-shadow:0 2px 18px rgba(0,0,0,0.65); max-width:920px;">
        ${esc(subText)}
      </p>` : ""}
    </div>

    <!-- Bottom CTA block -->
    <div style="
      position:absolute; bottom:64px; left:72px; right:72px;
      z-index:7; display:flex; flex-direction:column; gap:14px;">
      <p style="
        margin:0; font-size:30px; font-weight:600; line-height:1.3;
        color:${muteColor}; letter-spacing:-0.005em;">
        ${esc(ctaText)}
      </p>
      <div style="display:flex; align-items:baseline; gap:32px; margin-top:12px; flex-wrap:wrap;">
        <span style="
          font-size:54px; font-weight:900; color:${heroColor};
          letter-spacing:-0.015em; line-height:1;">
          ${PHONE}
        </span>
        <span style="
          font-size:26px; font-weight:500; color:${muteColor};
          letter-spacing:.02em; line-height:1;">
          ${WEBSITE}
        </span>
      </div>
    </div>

    ${photographerCredit}
  </div>`;
}

// ---------------------------------------------------------------------------
// buildCarousel — convenience: takes a spec object and returns [html, html, ...]
//   spec = {
//     theme: "T1",                              // required
//     hook: { en: "...", es: "...", badge? },
//     points: [{ headingEn, bodyEs }, ...]      // 0 or more
//     cta: { en?, es? }
//   }
// ---------------------------------------------------------------------------
export function buildCarousel(spec) {
  if (!spec || !spec.theme || !VALID_THEME_CODES.includes(spec.theme)) {
    throw new Error(`buildCarousel: invalid or missing theme, expected one of ${VALID_THEME_CODES.join(",")}`);
  }
  const slides = [];
  slides.push(slideHook(spec.theme, spec.hook || {}));
  const pts = Array.isArray(spec.points) ? spec.points : [];
  const total = pts.length;
  pts.forEach((p, i) => {
    slides.push(slidePoint(spec.theme, { ...p, index: i + 1, total }));
  });
  slides.push(slideCTA(spec.theme, spec.cta || {}));
  return slides;
}
