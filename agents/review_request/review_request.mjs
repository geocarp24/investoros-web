#!/usr/bin/env node
/**
 * review_request — pedido manual de reseña de Google (SMS + email opcional).
 *
 * NO es cron. Se dispara desde el CRM: Jorge marca el job como completado,
 * aprieta "Request Review" y el webhook router lanza este proceso con el
 * record id del lead.
 *
 * Usage:
 *   node agents/review_request/review_request.mjs <leadRecordId> [--tenant geo-carpentry] [--dry-run]
 *
 * Env:
 *   AIRTABLE_TOKEN_GEO      token del tenant (nombre real sale de tenant.airtable.token_env)
 *   QUO_API_KEY             obligatorio para envío real (el mismo que usa El Supervisor)
 *   QUO_FROM_NUMBER         número E.164 emisor, o tenant.quo.from_number
 *   GOOGLE_REVIEW_URL       link corto de reseña de Google
 *   DRY_RUN=true            no envía, no escribe en Airtable, solo imprime
 *   REVIEW_REQUEST_LOG      override del log (default /opt/alex-bot/logs/review_request.log)
 *
 * Exit codes: 0 enviado · 3 bloqueado por validación · 2 uso incorrecto · 1 fatal
 */
import { readFile, mkdir, appendFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const TENANTS_DIR = join(ROOT, "agents", "tenants");

const LOG_PATH = process.env.REVIEW_REQUEST_LOG || "/opt/alex-bot/logs/review_request.log";
const COOLDOWN_DAYS = 30;

// Geo_Leads (tblaH41HWeVG9ZXLn) — field IDs, estables ante renombres.
const F = {
  phone: "fldpKCnwHhMYvREDj",
  phone2: "fldgr4aQaEDI73J1l",
  fullName: "fldUqmulwBHGQCcxh",
  leadStatus: "fldytSAwcOBwqwUd2",
  language: "fld5vXtGIvU1unHuR",
  doNotContact: "fldUTOYSri5bcXSVQ",
  jobs: "flduFtNu4dyhfeBbg",
  reviewRequestedAt: "fldriwvb3O16lSpCk", // creado 2026-08-23 vía Airtable meta API
};

const GEO_LEADS_TABLE_FALLBACK = "tblaH41HWeVG9ZXLn";

// ---------- args ----------
function parseArgs(argv) {
  const a = { leadId: null, tenant: "geo-carpentry", dryRun: process.env.DRY_RUN === "true" };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--tenant" || k === "-t") a.tenant = argv[++i];
    else if (k === "--lead-id") a.leadId = argv[++i];
    else if (k === "--dry-run") a.dryRun = true;
    else if (k === "--help" || k === "-h") {
      console.log("Usage: review_request.mjs <leadRecordId> [--tenant <slug>] [--dry-run]");
      process.exit(0);
    } else if (!a.leadId && !k.startsWith("-")) a.leadId = k;
  }
  if (!a.leadId) die(2, "lead_id requerido como argumento (rec...)");
  if (!/^rec[A-Za-z0-9]{14}$/.test(a.leadId)) die(2, `lead_id inválido: ${a.leadId}`);
  if (!/^[a-z0-9_-]+$/.test(a.tenant)) die(2, `tenant inválido: ${a.tenant}`);
  return a;
}

function die(code, msg) {
  console.error(`[review_request] ${msg}`);
  process.exit(code);
}

async function loadTenant(slug) {
  const cfg = JSON.parse(await readFile(join(TENANTS_DIR, `${slug}.json`), "utf8"));
  if (!cfg.airtable?.base_id) throw new Error(`tenant.airtable.base_id missing en ${slug}.json`);
  return cfg;
}

// ---------- log ----------
async function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.error(`[review_request] ${line}`);
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, stamped + "\n", "utf8");
  } catch {
    /* log en disco es best-effort; nunca tumba el envío */
  }
}

// ---------- airtable ----------
function atCtx(cfg) {
  const token = process.env[cfg.airtable.token_env || "AIRTABLE_TOKEN"];
  if (!token) throw new Error(`env ${cfg.airtable.token_env || "AIRTABLE_TOKEN"} no está seteada`);
  return {
    base: cfg.airtable.base_id,
    token,
    leads: cfg.airtable.geo_leads_table_id || GEO_LEADS_TABLE_FALLBACK,
    contacts: cfg.airtable.contacts_table_id,
  };
}

async function fetchLead(c, leadId) {
  // returnFieldsByFieldId: sin esto Airtable devuelve las claves por NOMBRE y
  // todas las lecturas por field ID salen undefined — el check de DNC pasaría en falso.
  const url = `https://api.airtable.com/v0/${c.base}/${c.leads}/${leadId}?returnFieldsByFieldId=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${c.token}` } });
  if (!r.ok) throw new Error(`Airtable GET ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

async function markRequested(c, leadId, dryRun) {
  const today = new Date().toISOString().slice(0, 10);
  if (dryRun) return { dry_run: true, date: today };
  const r = await fetch(`https://api.airtable.com/v0/${c.base}/${c.leads}/${leadId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { [F.reviewRequestedAt]: today }, returnFieldsByFieldId: true }),
  });
  if (!r.ok) throw new Error(`Airtable PATCH ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { date: today };
}

/** Geo_Leads no tiene campo Email. Best-effort: cruzar Contacts por teléfono. */
async function resolveEmail(c, digits10) {
  if (!c.contacts || !digits10) return null;
  try {
    let offset = null;
    for (let page = 0; page < 5; page++) {
      const p = new URLSearchParams({ pageSize: "100" });
      p.append("fields[]", "Email");
      p.append("fields[]", "Phone");
      if (offset) p.set("offset", offset);
      const r = await fetch(`https://api.airtable.com/v0/${c.base}/${c.contacts}?${p}`, {
        headers: { Authorization: `Bearer ${c.token}` },
      });
      if (!r.ok) return null;
      const j = await r.json();
      for (const rec of j.records ?? []) {
        const email = rec.fields?.Email;
        const digits = String(rec.fields?.Phone ?? "").replace(/\D/g, "");
        if (email && digits.length >= 10 && digits.slice(-10) === digits10) return email;
      }
      offset = j.offset;
      if (!offset) break;
    }
  } catch {
    /* el email es opcional; el SMS es el canal principal */
  }
  return null;
}

// ---------- helpers ----------
function normalizePhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return { e164: `+1${digits}`, last10: digits };
  if (digits.length === 11 && digits.startsWith("1")) return { e164: `+${digits}`, last10: digits.slice(1) };
  return { e164: null, last10: digits.slice(-10) };
}

/** Airtable devuelve singleSelect como string; toleramos {name} por si acaso. */
function selectValue(v) {
  if (v == null) return null;
  return typeof v === "object" ? (v.name ?? null) : String(v);
}

function firstNameOf(fullName) {
  const n = String(fullName ?? "").trim().split(/\s+/)[0];
  return n || null;
}

function buildSMS(fullName, lang, reviewUrl) {
  const first = firstNameOf(fullName);
  if (lang === "Spanish") {
    const hola = first ? `¡Hola ${first}!` : "¡Hola!";
    return `${hola} Soy Jorge de Geo Carpentry. Fue un placer trabajar en su proyecto. Si quedó contento, le agradecería mucho una reseña rápida en Google — ayuda mucho a nuestro pequeño negocio. ${reviewUrl} ¡Gracias!`;
  }
  const hi = first ? `Hi ${first}!` : "Hi there!";
  return `${hi} It's Jorge from Geo Carpentry. We really enjoyed working on your project. If you're happy with the results, a quick Google review would mean the world to us. ${reviewUrl} Thanks so much!`;
}

function buildEmail(fullName, lang, reviewUrl) {
  const first = firstNameOf(fullName);
  if (lang === "Spanish") {
    return {
      subject: "¿Cómo quedó su proyecto?",
      body: [
        first ? `Hola ${first},` : "Hola,",
        "",
        "Soy Jorge, de Geo Carpentry. Gracias por confiarnos su proyecto.",
        "",
        "Si quedó contento con el trabajo, ¿nos deja una reseña en Google? Son dos minutos y para un negocio chico como el nuestro hace una diferencia enorme.",
        "",
        reviewUrl,
        "",
        "Y si algo no quedó como esperaba, respóndame este correo y lo vemos.",
        "",
        "Gracias,",
        "Jorge Cruz — Geo Carpentry LLC",
        "(920) 367-1272",
      ].join("\n"),
    };
  }
  return {
    subject: "How did your project turn out?",
    body: [
      first ? `Hi ${first},` : "Hi,",
      "",
      "This is Jorge from Geo Carpentry. Thanks for trusting us with your project.",
      "",
      "If you're happy with how it turned out, would you leave us a Google review? It takes two minutes and it makes a real difference for a small shop like ours.",
      "",
      reviewUrl,
      "",
      "And if anything fell short, just reply to this email and we'll make it right.",
      "",
      "Thanks,",
      "Jorge Cruz — Geo Carpentry LLC",
      "(920) 367-1272",
    ].join("\n"),
  };
}

// ---------- senders ----------
async function sendSMS(cfg, to, body, dryRun) {
  const from = process.env.QUO_FROM_NUMBER || cfg.quo?.from_number;
  if (dryRun) {
    console.log(`[DRY_RUN] SMS ${from ?? "(from sin configurar)"} -> ${to}
${body}`);
    return { ok: true, id: "dry_run" };
  }
  // Quo se sigue sirviendo desde el host de OpenPhone — es el mismo endpoint que
  // sondea El Supervisor. No cambiarlo a quo.com, no existe.
  const key = process.env[cfg.quo?.api_key_env || "QUO_API_KEY"];
  if (!key) throw new Error("QUO_API_KEY falta en .env");
  if (!from) throw new Error("QUO_FROM_NUMBER (o tenant.quo.from_number) falta");

  const r = await fetch("https://api.openphone.com/v1/messages", {
    method: "POST",
    // Quo manda la key cruda, sin "Bearer".
    headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ content: body, from, to: [to] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = j.message ?? j.errors?.[0]?.message ?? "error desconocido";
    throw new Error(`Quo ${r.status}: ${detail}`);
  }
  return { ok: true, id: j.data?.id, status: j.data?.status };
}

/** Mismo canal que El Remitente: Hostinger send_notification.php. */
async function sendEmail(cfg, to, subject, body, dryRun) {
  if (dryRun) {
    console.log(`[DRY_RUN] EMAIL TO: ${to}\nSUBJECT: ${subject}\n${body}`);
    return { ok: true, dry_run: true };
  }
  const site = String(cfg.website ?? "").replace(/\/$/, "");
  if (!site) return { ok: false, error: "tenant.website no configurado" };
  try {
    const r = await fetch(`${site}/Tools/send_notification.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email", to, subject, body }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: j.success === true, http: r.status, response: j };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function telegram(cfg, text) {
  const token = process.env[cfg.telegram?.bot_token_env || "TELEGRAM_BOT_TOKEN"];
  const chat = process.env[cfg.telegram?.chat_id_env || "TELEGRAM_CHAT_ID"];
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ chat_id: chat, text, parse_mode: "Markdown" }).toString(),
    });
  } catch {
    /* notificación best-effort */
  }
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv);
  const cfg = await loadTenant(args.tenant);
  const c = atCtx(cfg);

  const reviewUrl = process.env.GOOGLE_REVIEW_URL;
  if (!reviewUrl) die(2, "GOOGLE_REVIEW_URL no está seteada en .env");

  const record = await fetchLead(c, args.leadId);
  const f = record.fields ?? {};
  const name = f[F.fullName] ?? "";
  const label = `${name || "(sin nombre)"} ${args.leadId}`;

  // ── Validaciones de seguridad — cualquiera aborta sin enviar ──
  const blocked = [];
  if (f[F.doNotContact] === true) blocked.push("DNC marcado");
  if (selectValue(f[F.leadStatus]) === "DNC") blocked.push("Lead Status = DNC");

  const last = f[F.reviewRequestedAt];
  if (last) {
    const days = Math.floor((Date.now() - new Date(`${last}T00:00:00Z`).getTime()) / 86_400_000);
    if (days < COOLDOWN_DAYS) blocked.push(`ya se pidió hace ${days}d (cooldown ${COOLDOWN_DAYS}d)`);
  }

  if ((f[F.jobs] ?? []).length === 0) blocked.push("sin job linked");

  const { e164, last10 } = normalizePhone(f[F.phone]);
  if (!e164) blocked.push(`teléfono inválido: ${f[F.phone] ?? "(vacío)"}`);

  if (blocked.length) {
    await log(`BLOCKED ${label} — ${blocked.join(" | ")}`);
    console.log(JSON.stringify({ ok: false, blocked: true, lead_id: args.leadId, reasons: blocked }));
    process.exitCode = 3;
    return;
  }

  const lang = selectValue(f[F.language]) === "Spanish" ? "Spanish" : "English";
  const dry = args.dryRun;

  await log(`SEND${dry ? " (DRY_RUN)" : ""} ${label} → ${e164} [${lang}]`);

  const sms = await sendSMS(cfg, e164, buildSMS(name, lang, reviewUrl), dry);
  await log(`SMS OK ${label} id=${sms.id}`);

  // Email: opcional. Geo_Leads no guarda email, se busca en Contacts por teléfono.
  let email = null;
  const addr = await resolveEmail(c, last10);
  if (addr) {
    const tmpl = buildEmail(name, lang, reviewUrl);
    const res = await sendEmail(cfg, addr, tmpl.subject, tmpl.body, dry);
    email = { to: addr, ...res };
    await log(res.ok ? `EMAIL OK ${label} → ${addr}` : `EMAIL FAIL ${label} → ${addr}: ${res.error ?? res.http}`);
  } else {
    await log(`EMAIL SKIP ${label} — sin email en Contacts`);
  }

  const marked = await markRequested(c, args.leadId, dry);
  await log(`DONE${dry ? " (DRY_RUN — Airtable sin tocar)" : ""} ${label}`);

  if (!dry) {
    await telegram(
      cfg,
      `⭐ *Review request enviada*\n${name || args.leadId} · ${e164} · ${lang}${email?.ok ? "\n📧 email también" : ""}`
    );
  }

  console.log(
    JSON.stringify({
      ok: true,
      dry_run: dry,
      lead_id: args.leadId,
      name,
      to: e164,
      language: lang,
      sms_id: sms.id,
      email,
      review_requested_at: marked.date,
    })
  );
}

// process.exitCode en vez de process.exit(): con fetch pendiente, un exit duro
// aborta handles vivos de libuv y el código de salida se pierde.
main().catch(async (e) => {
  await log(`FATAL ${e.message}`);
  console.log(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
});
