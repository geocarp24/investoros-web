#!/usr/bin/env node
/**
 * El Remitente — email agent orchestrator (Airtable-native, Hostinger SMTP).
 *
 * Usage:
 *   node agents/remitente/remitente.mjs --tenant <slug> --mode <mode> [options]
 *
 * Modes:
 *   seed_templates     — crea 4 templates base (welcome_en/es, nurture_market_update_en/es)
 *   draft_campaign     — redacta una campaña (--topic + --audience + opcional --content-queue-id)
 *   schedule_send      — aprueba + schedulea campaign id (--campaign-id + --at ISO datetime)
 *   process_welcome    — busca nuevos Active subscribers + les manda welcome
 *   process_drip       — tick diario de sequences
 *   weekly_report      — stats últimos 7 días, manda a Telegram
 *   on_demand          — draft + schedule inmediato
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const TENANTS_DIR = join(ROOT, "agents", "tenants");
const OUTPUT_DIR = join(__dirname, "runs");

const VALID_MODES = ["seed_templates","draft_campaign","schedule_send","process_welcome","process_drip","weekly_report","on_demand"];

function parseArgs(argv) {
  const a = { mode: null, tenant: null, dryRun: false, topic: null, audience: null,
              contentQueueId: null, campaignId: null, at: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--tenant"   || k === "-t") a.tenant = argv[++i];
    else if (k === "--mode"|| k === "-m") a.mode = argv[++i];
    else if (k === "--topic")             a.topic = argv[++i];
    else if (k === "--audience")          a.audience = argv[++i];
    else if (k === "--content-queue-id")  a.contentQueueId = argv[++i];
    else if (k === "--campaign-id")       a.campaignId = argv[++i];
    else if (k === "--at")                a.at = argv[++i];
    else if (k === "--dry-run")           a.dryRun = true;
    else if (k === "--help") { console.log("see SKILL.md for mode options"); process.exit(0); }
  }
  if (!a.tenant) { console.error("ERROR: --tenant required"); process.exit(2); }
  if (!VALID_MODES.includes(a.mode)) { console.error(`ERROR: --mode must be one of ${VALID_MODES.join(", ")}`); process.exit(2); }
  return a;
}

async function loadTenant(slug) {
  const p = join(TENANTS_DIR, `${slug}.json`);
  const raw = await readFile(p, "utf8");
  const cfg = JSON.parse(raw);
  for (const k of ["tenant_id","website","claude"]) if (cfg[k] == null) throw new Error(`tenant.${k} missing`);
  return cfg;
}

function runClaude(binary, prompt, timeoutMs = 20 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["--print","--permission-mode","acceptEdits", prompt], { stdio:["ignore","pipe","pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("timeout")); }, timeoutMs);
    child.stdout.on("data", d => out += d);
    child.stderr.on("data", d => err += d);
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve(out) : reject(new Error(`claude exit ${code}: ${err.slice(0,300)}`)); });
    child.on("error", e => { clearTimeout(timer); reject(e); });
  });
}

// ===== Airtable helpers =====
function at_config(cfg) {
  return {
    base:   cfg.airtable?.base_id,
    token:  process.env[cfg.airtable?.token_env || "AIRTABLE_TOKEN"],
    subs:   cfg.airtable?.email_subscribers_table_id,
    temp:   cfg.airtable?.email_templates_table_id,
    camp:   cfg.airtable?.email_campaigns_table_id,
    evt:    cfg.airtable?.email_events_table_id,
    queue:  cfg.airtable?.content_queue_table_id,
  };
}

async function at_get(cfg, table, params = "") {
  const c = at_config(cfg);
  if (!c.base || !c.token || !table) return { records: [] };
  const url = `https://api.airtable.com/v0/${c.base}/${table}${params ? "?" + params : ""}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${c.token}` } });
  return await r.json().catch(() => ({ records: [] }));
}

async function at_create(cfg, table, fields) {
  const c = at_config(cfg);
  const r = await fetch(`https://api.airtable.com/v0/${c.base}/${table}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return await r.json();
}

async function at_update(cfg, table, recordId, fields) {
  const c = at_config(cfg);
  const r = await fetch(`https://api.airtable.com/v0/${c.base}/${table}/${recordId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return await r.json();
}

async function telegram(cfg, text) {
  const token = process.env[cfg.telegram?.bot_token_env || "TELEGRAM_BOT_TOKEN"];
  const chat  = process.env[cfg.telegram?.chat_id_env   || "TELEGRAM_CHAT_ID"];
  if (!token || !chat) { console.error("[remitente] telegram not configured"); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chat, text, parse_mode: "Markdown" }).toString(),
    });
  } catch (e) { console.error("[remitente] telegram error:", e.message); }
}

// ===== Mode: seed_templates =====
async function modeSeedTemplates(cfg) {
  const c = at_config(cfg);
  const base_html = (title, body) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0D3B2E;">
<div style="max-width:600px;margin:0 auto;padding:32px 20px;background:#FFFFFF;">
  <img src="${cfg.brand?.logo_url || ""}" alt="Pinnacle" style="width:150px;max-width:40%;margin-bottom:24px;" />
  <h1 style="font-size:26px;margin:0 0 16px;letter-spacing:-0.01em;color:#0D3B2E;">${title}</h1>
  ${body}
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #E5DFD4;font-size:12px;color:#6B6455;line-height:1.5;">
    Pinnacle Holdings Group LLC · ${cfg.brand?.phone || ""} · <a href="${cfg.website}" style="color:#0D3B2E;">${cfg.website.replace(/^https?:\/\//,"")}</a><br>
    <a href="{{unsub_url}}" style="color:#6B6455;">Unsubscribe</a>
  </div>
</div></body></html>`;

  const seeds = [
    {
      template_id: randomUUID(),
      tenant_id: cfg.tenant_id,
      name: "welcome_en",
      category: "welcome",
      language: "en",
      subject_template: "Welcome — your first Wisconsin homeowner guide",
      preview_text_template: "No pressure. Know your options first.",
      body_html: base_html("You're in!", `
        <p style="font-size:15px;line-height:1.6;">Thanks for subscribing. Every couple weeks you'll get a short, honest email with pros &amp; cons of every path for Wisconsin homeowners facing foreclosure, probate, tax liens, or a fast sale.</p>
        <p style="font-size:15px;line-height:1.6;">Your first guide is coming in the next email. Meanwhile, if you'd rather get a cash offer quote in 24 hours, just <a href="${cfg.website}/get-my-offer/" style="color:#0D3B2E;font-weight:700;">tell us about your property</a>.</p>
        <p style="font-size:15px;line-height:1.6;">— Pinnacle Holdings team</p>
      `),
      body_text: "Thanks for subscribing. Every couple weeks you'll get short honest guides for Wisconsin homeowners. First guide coming in the next email. If you want a 24-hour cash offer, reply or go to " + cfg.website + "/get-my-offer/\n\n-- Unsubscribe: {{unsub_url}}",
    },
    {
      template_id: randomUUID(),
      tenant_id: cfg.tenant_id,
      name: "welcome_es",
      category: "welcome",
      language: "es",
      subject_template: "¡Bienvenido! — tu primera guía para dueños de casa en Wisconsin",
      preview_text_template: "Sin presión. Conoce tus opciones primero.",
      body_html: base_html("¡Listo!", `
        <p style="font-size:15px;line-height:1.6;">Gracias por suscribirte. Cada dos semanas recibirás un email corto y honesto con los pros y contras de cada opción para dueños de casa en Wisconsin que enfrentan foreclosure, herencias, impuestos atrasados o venta rápida.</p>
        <p style="font-size:15px;line-height:1.6;">Tu primera guía viene en el siguiente correo. Si prefieres una oferta en efectivo en 24 horas, <a href="${cfg.website}/get-my-offer/" style="color:#0D3B2E;font-weight:700;">cuéntanos sobre tu propiedad</a>.</p>
        <p style="font-size:15px;line-height:1.6;">— Equipo Pinnacle Holdings</p>
      `),
      body_text: "Gracias por suscribirte. Cada 2 semanas recibirás guías honestas para dueños de casa en Wisconsin. Tu primera guía viene pronto. Para oferta en efectivo en 24 horas visita " + cfg.website + "/get-my-offer/\n\n-- Cancelar suscripción: {{unsub_url}}",
    },
    {
      template_id: randomUUID(),
      tenant_id: cfg.tenant_id,
      name: "nurture_market_update_en",
      category: "nurture",
      language: "en",
      subject_template: "Wisconsin market update — {{month}} {{year}}",
      preview_text_template: "Prices, foreclosure stats, and what it means for you",
      body_html: base_html("Wisconsin market update", `
        <p style="font-size:15px;line-height:1.6;">Quick monthly recap of what's happening in the Wisconsin residential market — priced for the homeowner, not the investor.</p>
        <h2 style="font-size:18px;margin:24px 0 8px;color:#0D3B2E;">By the numbers</h2>
        <ul style="font-size:15px;line-height:1.6;padding-left:20px;">
          <li>{{median_price_stat}}</li>
          <li>{{foreclosure_stat}}</li>
          <li>{{inventory_stat}}</li>
        </ul>
        <h2 style="font-size:18px;margin:24px 0 8px;color:#0D3B2E;">What it means if you're thinking of selling</h2>
        <p style="font-size:15px;line-height:1.6;">{{commentary}}</p>
        <p style="font-size:15px;line-height:1.6;margin-top:20px;"><a href="${cfg.website}/get-my-offer/" style="display:inline-block;background:#C9A84C;color:#0D3B2E;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:800;">Get your cash offer</a></p>
      `),
      body_text: "Wisconsin market update — monthly recap. See full post at " + cfg.website + "/news/ — Unsubscribe: {{unsub_url}}",
    },
    {
      template_id: randomUUID(),
      tenant_id: cfg.tenant_id,
      name: "nurture_market_update_es",
      category: "nurture",
      language: "es",
      subject_template: "Mercado Wisconsin — {{month}} {{year}}",
      preview_text_template: "Precios, estadísticas de foreclosure y qué significan para ti",
      body_html: base_html("Actualización del mercado en Wisconsin", `
        <p style="font-size:15px;line-height:1.6;">Resumen mensual de qué pasa en el mercado residencial de Wisconsin — pensado para el dueño de casa, no para el inversionista.</p>
        <h2 style="font-size:18px;margin:24px 0 8px;color:#0D3B2E;">En números</h2>
        <ul style="font-size:15px;line-height:1.6;padding-left:20px;">
          <li>{{median_price_stat}}</li>
          <li>{{foreclosure_stat}}</li>
          <li>{{inventory_stat}}</li>
        </ul>
        <h2 style="font-size:18px;margin:24px 0 8px;color:#0D3B2E;">Qué significa si estás pensando en vender</h2>
        <p style="font-size:15px;line-height:1.6;">{{commentary}}</p>
        <p style="font-size:15px;line-height:1.6;margin-top:20px;"><a href="${cfg.website}/get-my-offer/" style="display:inline-block;background:#C9A84C;color:#0D3B2E;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:800;">Pide tu oferta</a></p>
      `),
      body_text: "Mercado Wisconsin mensual. Artículo completo: " + cfg.website + "/news/ — Cancelar suscripción: {{unsub_url}}",
    },
  ];

  for (const t of seeds) {
    const r = await at_create(cfg, c.temp, t);
    console.error(`  ✓ template seeded: ${t.name} → ${r.id || "(error: " + JSON.stringify(r).slice(0,200) + ")"}`);
  }
  await telegram(cfg, `📨 *El Remitente* — 4 templates sembrados en base Pinnacle`);
}

// ===== Mode: draft_campaign =====
async function modeDraftCampaign(cfg, args) {
  const c = at_config(cfg);
  let sourceContent = "";
  if (args.contentQueueId) {
    const res = await at_get(cfg, c.queue, `filterByFormula=${encodeURIComponent(`{run_id}='${args.contentQueueId}'`)}&maxRecords=1`);
    sourceContent = res.records?.[0]?.fields?.body_md || "";
  }

  const prompt = `You are El Remitente, email marketing sub-agent. Modo: draft_campaign.

Tenant: "${cfg.tenant_name}" (${cfg.industry})
Website: ${cfg.website}
Tone: ${cfg.content_goals?.tone || "empathic + educational"}
Languages: ${(cfg.content_goals?.languages || ["en"]).join(", ")}
Primary market: ${(cfg.markets?.[0]?.cities_primary || []).slice(0,5).join(", ")} (Wisconsin state-wide)

Topic: ${args.topic || "(from source content)"}
Audience filter: ${args.audience || "{status}='Active'"}
${sourceContent ? `\nSource content (from Content_Queue):\n${sourceContent.slice(0, 3000)}` : ""}

Produce email draft. Output format (strict):

\`\`\`yaml
---
subject: "..." (under 60 chars, specific, no emoji spam)
preview_text: "..." (under 90 chars — shows in inbox next to subject)
audience_filter: "${args.audience || `{status}='Active'`}"
category: nurture | promo | lead_magnet_delivery
---
\`\`\`

## BODY_HTML

<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,sans-serif;color:#0D3B2E;">
<div style="max-width:600px;margin:0 auto;padding:32px 20px;background:#fff;">
  (full email HTML — mobile-first, 600px max-width, H1+body+CTA+footer+unsub link {{unsub_url}})
</div></body></html>

## BODY_TEXT

(plain text version of same content, with final line: -- Unsubscribe: {{unsub_url}})

Rules:
- Mobile-first: paragraphs 2-4 lines max, 15-16px font, scannable
- 1 primary CTA — link to ${cfg.website}/get-my-offer/
- Empathic tone for WI homeowners in distress — NO investor jargon ("deals", "off-market", "cap rate" forbidden)
- Subject under 60 chars, preview under 90
- Must include {{unsub_url}} placeholder in both HTML and text versions
- Do NOT include tracking pixel or click URLs — those are injected by the PHP sender at send-time`;

  const out = await runClaude(cfg.claude.binary_path, prompt);

  // Parse subject/preview from YAML block
  const subj = (out.match(/subject:\s*["']?([^"'\n]+)["']?/i) || [,""])[1].trim();
  const prev = (out.match(/preview_text:\s*["']?([^"'\n]+)["']?/i) || [,""])[1].trim();
  const audi = (out.match(/audience_filter:\s*["']?([^"'\n]+)["']?/i) || [,""])[1].trim();
  const htmlMatch  = out.match(/##\s*BODY_HTML\s*\n([\s\S]+?)(?=##\s|$)/i);
  const textMatch  = out.match(/##\s*BODY_TEXT\s*\n([\s\S]+?)$/i);
  const body_html  = htmlMatch ? htmlMatch[1].trim() : "";
  const body_text  = textMatch ? textMatch[1].trim() : "";

  const campaign_id = randomUUID();
  await at_create(cfg, c.camp, {
    campaign_id,
    tenant_id: cfg.tenant_id,
    name: args.topic?.slice(0,100) || "on-demand-" + new Date().toISOString().slice(0,10),
    status: "Draft",
    subject: subj,
    preview_text: prev,
    audience_filter: audi || args.audience || `{status}='Active'`,
    body_html,
    body_text,
    source_content_queue_id: args.contentQueueId || "",
    trigger: "manual",
  });

  await telegram(cfg, `📧 *El Remitente* — draft email listo para review\nsubject: \`${subj}\`\nid: \`${campaign_id.slice(0,8)}\`\nReview en Email_Campaigns → status=Scheduled + scheduled_at para enviar`);
  console.error(`[remitente] draft created campaign_id=${campaign_id}`);
}

// ===== SMTP helper — sends via Hostinger send_notification.php =====
async function sendEmailSmtp(cfg, to, subject, bodyText) {
  const site = (cfg.website || "").replace(/\/$/, "");
  try {
    const r = await fetch(`${site}/Tools/send_notification.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email", to, subject, body: bodyText }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: j.success === true, response: j, http: r.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function unsubUrl(cfg, token) {
  const site = (cfg.website || "").replace(/\/$/, "");
  return `${site}/agents/pinnacle_mail.php?action=unsubscribe&t=${encodeURIComponent(token || "")}`;
}

function renderTemplate(tmpl, sub, cfg) {
  const email = sub.email || "";
  const name = (email.split("@")[0] || "friend").replace(/[._-]/g, " ");
  const vars = {
    "{{unsub_url}}": unsubUrl(cfg, sub.unsubscribe_token),
    "{{email}}":    email,
    "{{name}}":     name,
    "{{month}}":    new Date().toLocaleString("en-US", { month: "long" }),
    "{{year}}":     String(new Date().getFullYear()),
  };
  const replaceAll = (s) => {
    let out = String(s || "");
    for (const [k, v] of Object.entries(vars)) out = out.split(k).join(v);
    return out;
  };
  return {
    subject: replaceAll(tmpl.subject_template),
    body:    replaceAll(tmpl.body_text || tmpl.body_html || ""),
  };
}

async function fetchTemplatesByCategory(cfg, category) {
  const c = at_config(cfg);
  const q = await at_get(cfg, c.temp,
    `filterByFormula=${encodeURIComponent(`{category}='${category}'`)}&pageSize=20`);
  const byLang = {};
  for (const r of q.records || []) {
    const f = r.fields;
    if (f.language) byLang[f.language] = f;
  }
  return byLang;
}

async function logEvent(cfg, subscriberEmail, templateId, eventType, metadata = "") {
  const c = at_config(cfg);
  if (!c.evt) return;
  await at_create(cfg, c.evt, {
    event_id:         randomUUID(),
    tenant_id:        cfg.tenant_id,
    subscriber_email: subscriberEmail,
    template_id:      templateId || "",
    event_type:       eventType,
    ts:               new Date().toISOString(),
    metadata:         metadata,
  }).catch(() => {});
}

// ===== Mode: process_welcome =====
async function modeProcessWelcome(cfg) {
  const c = at_config(cfg);
  // Active subscribers that have NEVER received any email yet
  const formula = `AND({status}='Active', OR({last_email_sent_at}=BLANK(), {last_email_sent_at}=''))`;
  const q = await at_get(cfg, c.subs,
    `filterByFormula=${encodeURIComponent(formula)}&pageSize=20&sort[0][field]=subscribed_at&sort[0][direction]=asc`);
  const subs = q.records || [];

  if (subs.length === 0) {
    console.error("[remitente] process_welcome: no pending welcomes");
    return { sent: 0, errs: 0 };
  }

  const tmpls = await fetchTemplatesByCategory(cfg, "welcome");
  if (!tmpls.en && !tmpls.es) {
    console.error("[remitente] process_welcome: no welcome templates seeded — run seed_templates first");
    return { sent: 0, errs: subs.length };
  }

  let sent = 0, errs = 0;
  for (const r of subs) {
    const f = r.fields;
    const lang = (f.lang === "es") ? "es" : "en";
    const tmpl = tmpls[lang] || tmpls.en || tmpls.es;
    if (!tmpl) { errs++; continue; }

    const rendered = renderTemplate(tmpl, f, cfg);
    const result = await sendEmailSmtp(cfg, f.email, rendered.subject, rendered.body);
    if (result.ok) {
      sent++;
      await at_update(cfg, c.subs, r.id, { last_email_sent_at: new Date().toISOString() });
      await logEvent(cfg, f.email, tmpl.template_id, "sent", "welcome");
      console.error(`[remitente] welcome sent: ${f.email} (${lang})`);
    } else {
      errs++;
      await logEvent(cfg, f.email, tmpl.template_id, "error", String(result.error || result.http));
      console.error(`[remitente] welcome FAILED: ${f.email} err=${result.error || result.http}`);
    }
    await new Promise((r) => setTimeout(r, 500)); // 2/sec pacing
  }

  const msg = `📧 *El Remitente — welcomes*\nsent: ${sent} · errors: ${errs} · pending: ${subs.length - sent - errs}`;
  await telegram(cfg, msg);
  return { sent, errs };
}

// ===== Mode: process_drip =====
// Sends nurture email to subscribers whose last email was >= 14 days ago.
async function modeProcessDrip(cfg) {
  const c = at_config(cfg);
  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const formula = `AND({status}='Active', {last_email_sent_at}!='', IS_BEFORE({last_email_sent_at}, DATETIME_PARSE('${cutoff}')))`;
  const q = await at_get(cfg, c.subs,
    `filterByFormula=${encodeURIComponent(formula)}&pageSize=20&sort[0][field]=last_email_sent_at&sort[0][direction]=asc`);
  const subs = q.records || [];

  if (subs.length === 0) {
    console.error("[remitente] process_drip: no subscribers due for drip");
    return { sent: 0, errs: 0 };
  }

  const tmpls = await fetchTemplatesByCategory(cfg, "nurture");
  if (!tmpls.en && !tmpls.es) {
    console.error("[remitente] process_drip: no nurture templates available");
    return { sent: 0, errs: subs.length };
  }

  let sent = 0, errs = 0;
  for (const r of subs) {
    const f = r.fields;
    const lang = (f.lang === "es") ? "es" : "en";
    const tmpl = tmpls[lang] || tmpls.en || tmpls.es;
    if (!tmpl) { errs++; continue; }

    const rendered = renderTemplate(tmpl, f, cfg);
    const result = await sendEmailSmtp(cfg, f.email, rendered.subject, rendered.body);
    if (result.ok) {
      sent++;
      await at_update(cfg, c.subs, r.id, { last_email_sent_at: new Date().toISOString() });
      await logEvent(cfg, f.email, tmpl.template_id, "sent", "drip_nurture");
    } else {
      errs++;
      await logEvent(cfg, f.email, tmpl.template_id, "error", String(result.error || result.http));
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const msg = `💧 *El Remitente — drip tick*\nsent: ${sent} · errors: ${errs} · due: ${subs.length}`;
  await telegram(cfg, msg);
  return { sent, errs };
}

// ===== Mode: schedule_send =====
// Manually fires a specific campaign by campaign_id to all Active subscribers.
async function modeScheduleSend(cfg, args) {
  const c = at_config(cfg);
  if (!args.campaignId) {
    console.error("[remitente] schedule_send requires --campaign-id <id>");
    process.exit(2);
  }
  // Fetch campaign
  const campQ = await at_get(cfg, c.camp,
    `filterByFormula=${encodeURIComponent(`{campaign_id}='${args.campaignId}'`)}&maxRecords=1`);
  if (!(campQ.records || []).length) {
    console.error(`[remitente] schedule_send: campaign_id='${args.campaignId}' not found`);
    process.exit(2);
  }
  const camp = campQ.records[0];
  const cf = camp.fields;

  // Load template
  const tmplQ = await at_get(cfg, c.temp,
    `filterByFormula=${encodeURIComponent(`{template_id}='${cf.template_id || ""}'`)}&maxRecords=1`);
  const tmpl = (tmplQ.records || [])[0]?.fields;
  if (!tmpl) {
    console.error(`[remitente] schedule_send: template not found for campaign`);
    process.exit(2);
  }

  // Fetch subscribers (respect audience_filter if present, else all Active)
  const baseFilter = "{status}='Active'";
  const audienceFilter = cf.audience_filter ? `AND(${baseFilter},${cf.audience_filter})` : baseFilter;
  const q = await at_get(cfg, c.subs,
    `filterByFormula=${encodeURIComponent(audienceFilter)}&pageSize=100`);
  const subs = q.records || [];

  console.error(`[remitente] schedule_send: campaign='${cf.name || args.campaignId}' targets=${subs.length}`);

  // Mark campaign Sending
  await at_update(cfg, c.camp, camp.id, { status: "Sending", started_at: new Date().toISOString() });

  let sent = 0, errs = 0;
  for (const r of subs) {
    const f = r.fields;
    const rendered = renderTemplate(tmpl, f, cfg);
    const result = await sendEmailSmtp(cfg, f.email, rendered.subject, rendered.body);
    if (result.ok) {
      sent++;
      await at_update(cfg, c.subs, r.id, { last_email_sent_at: new Date().toISOString() });
      await logEvent(cfg, f.email, tmpl.template_id, "sent", `campaign:${args.campaignId}`);
    } else {
      errs++;
      await logEvent(cfg, f.email, tmpl.template_id, "error", `campaign:${args.campaignId}:${result.error || result.http}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  await at_update(cfg, c.camp, camp.id, {
    status: "Sent",
    completed_at: new Date().toISOString(),
    total_sent: sent,
    total_errors: errs,
  });

  const msg = `📣 *El Remitente — campaign sent*\n\`${cf.name || args.campaignId}\`\nsent: ${sent} · errors: ${errs} · targeted: ${subs.length}`;
  await telegram(cfg, msg);
  return { sent, errs };
}

// ===== Mode: weekly_report =====
async function modeWeeklyReport(cfg) {
  const c = at_config(cfg);
  const sevenDaysAgo = new Date(Date.now() - 7*24*3600*1000).toISOString();
  const events = await at_get(cfg, c.evt, `filterByFormula=${encodeURIComponent(`IS_AFTER({event_at},DATETIME_PARSE('${sevenDaysAgo}'))`)}&pageSize=100`);
  const rows = events.records || [];
  const counts = {};
  for (const r of rows) { const k = r.fields?.event_type || "unknown"; counts[k] = (counts[k]||0) + 1; }

  const sent = counts.sent || 0;
  const opens = counts.opened || 0;
  const clicks = counts.clicked || 0;
  const unsubs = counts.unsubscribed || 0;
  const openRate = sent ? ((opens/sent)*100).toFixed(1) : "0.0";
  const ctr      = sent ? ((clicks/sent)*100).toFixed(1) : "0.0";

  const msg = `📊 *El Remitente — weekly report*\n\nÚltimos 7 días:\n• Sent: ${sent}\n• Opened: ${opens} (${openRate}%)\n• Clicked: ${clicks} (${ctr}%)\n• Unsubscribed: ${unsubs}\n\nBenchmark open rate real estate: 25–35%`;
  await telegram(cfg, msg);
  console.error(`[remitente] weekly_report sent=${sent} opens=${opens} clicks=${clicks} unsubs=${unsubs}`);
}

// ===== Main =====
async function main() {
  const args = parseArgs(process.argv);
  const cfg = await loadTenant(args.tenant);
  console.error(`[remitente] tenant=${cfg.tenant_id} mode=${args.mode} dry_run=${args.dryRun}`);

  if (args.dryRun) {
    console.log(`=== DRY RUN mode=${args.mode} — tenant loaded, would execute against Airtable + claude CLI ===`);
    console.log("Config snapshot:");
    console.log("  base_id:", cfg.airtable?.base_id);
    console.log("  tables: subs=" + cfg.airtable?.email_subscribers_table_id + " temp=" + cfg.airtable?.email_templates_table_id + " camp=" + cfg.airtable?.email_campaigns_table_id + " evt=" + cfg.airtable?.email_events_table_id);
    console.log("  languages:", cfg.content_goals?.languages);
    console.log("  cron:", args.mode === "process_welcome" ? "would scan new subscribers" : "would run mode logic");
    return;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  if (args.mode === "seed_templates")        await modeSeedTemplates(cfg);
  else if (args.mode === "draft_campaign")   await modeDraftCampaign(cfg, args);
  else if (args.mode === "process_welcome")  await modeProcessWelcome(cfg);
  else if (args.mode === "process_drip")     await modeProcessDrip(cfg);
  else if (args.mode === "schedule_send")    await modeScheduleSend(cfg, args);
  else if (args.mode === "weekly_report")    await modeWeeklyReport(cfg);
  else if (args.mode === "on_demand") {
    // alias for draft_campaign + auto-schedule scheduled_at=now+5min
    await modeDraftCampaign(cfg, args);
  }
  else {
    console.error(`[remitente] mode ${args.mode} unknown`);
    process.exit(2);
  }
}

main().catch((e) => { console.error("[remitente] FATAL:", e); process.exit(1); });
