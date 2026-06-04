#!/usr/bin/env node
/**
 * Eli (Escriba) — WordPress Publisher Agent
 * Reads Content_Queue rows with status="ready_to_publish" and publishes
 * to WordPress via REST API using credentials from the Supabase vault.
 *
 * Usage:
 *   node agents/escriba/escriba.mjs --tenant geo-carpentry --mode publish_batch --max 2
 *
 * Environment vars (from /opt/alex-bot/.env):
 *   AIRTABLE_TOKEN_GEO    — Airtable PAT
 *   WEBHOOK_SECRET        — shared secret (c30b4c...) for internal Vercel API call
 *   TELEGRAM_BOT_TOKEN    — Jorge's bot token
 *   TELEGRAM_CHAT_ID      — Jorge's chat ID
 *
 * CC blocker: needs GET /api/internal/tenant-config endpoint live in Vercel
 *   before this script can fetch WP credentials from the vault.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const getArg  = (name, fallback = null) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : fallback;
};

const TENANT_SLUG = getArg('tenant', 'geo-carpentry');
const MODE        = getArg('mode',   'publish_batch');
const MAX_POSTS   = parseInt(getArg('max', '2'), 10);

// ── Env vars ──────────────────────────────────────────────────────────────────
const AIRTABLE_TOKEN      = process.env.AIRTABLE_TOKEN_GEO;
const WEBHOOK_SECRET      = process.env.WEBHOOK_SECRET;
const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID    = process.env.TELEGRAM_CHAT_ID;

if (!AIRTABLE_TOKEN)  throw new Error('Missing env var: AIRTABLE_TOKEN_GEO');
if (!WEBHOOK_SECRET)  throw new Error('Missing env var: WEBHOOK_SECRET');

// ── Load local tenant JSON ────────────────────────────────────────────────────
function loadTenantConfig(slug) {
  const configPath = path.resolve(__dirname, `../tenants/${slug}.json`);
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (e) {
    throw new Error(`Cannot read tenant config at ${configPath}: ${e.message}`);
  }
}

// ── Fetch WP credentials from Vercel vault ────────────────────────────────────
// Requires CC to build: GET /api/internal/tenant-config?tenant=<slug>
// Headers: x-internal-secret: <WEBHOOK_SECRET>
// Response: { wordpress: { url, username, appPassword }, ... }
async function fetchWPCredentials(tenantSlug) {
  const url = `https://www.investoros.tech/api/internal/tenant-config?tenant=${encodeURIComponent(tenantSlug)}`;
  const res = await fetch(url, {
    headers: {
      'x-internal-secret': WEBHOOK_SECRET,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`tenant-config API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();

  if (!data?.wordpress?.username || !data?.wordpress?.appPassword) {
    throw new Error(
      `WP credentials missing or incomplete in vault for tenant: ${tenantSlug}. ` +
      `Ensure 'wordpress/app_password' is seeded via /api/admin/seed-tenant-credential.`
    );
  }

  return data.wordpress; // { url, username, appPassword }
}

// ── Airtable helpers ──────────────────────────────────────────────────────────
const AIRTABLE_BASE         = 'appAQpveuAec077jF';
const CONTENT_QUEUE_TABLE   = 'tblpiN42pK3YFxGEW';
const AT_BASE_URL           = `https://api.airtable.com/v0/${AIRTABLE_BASE}`;

async function fetchContentQueue(tenantSlug, max) {
  const formula = encodeURIComponent(
    `AND({status}="ready_to_publish",{tenant_id}="${tenantSlug}")`
  );
  const url = (
    `${AT_BASE_URL}/${CONTENT_QUEUE_TABLE}` +
    `?filterByFormula=${formula}` +
    `&maxRecords=${max}` +
    `&sort[0][field]=created_at&sort[0][direction]=asc`
  );

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Airtable fetch failed ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.records || [];
}

async function updateAirtableRow(recordId, fields) {
  const url = `${AT_BASE_URL}/${CONTENT_QUEUE_TABLE}/${recordId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Airtable update failed ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

// ── Markdown → HTML ───────────────────────────────────────────────────────────
// Handles the content format used in Content_Queue body_md field.
// If the field is already HTML (starts with <), passes through unchanged.
// Normalize special chars to HTML entities so WP/MySQL charset issues don't
// produce "?" for em-dashes, smart quotes, ellipsis, etc.
function normalizeSpecialChars(text) {
  return text
    .replace(/—/g, '&mdash;')      // em dash —
    .replace(/–/g, '&ndash;')      // en dash –
    .replace(/‘/g, '&lsquo;')      // left single quote '
    .replace(/’/g, '&rsquo;')      // right single quote '
    .replace(/“/g, '&ldquo;')      // left double quote "
    .replace(/”/g, '&rdquo;')      // right double quote "
    .replace(/…/g, '&hellip;')     // ellipsis …
    .replace(/®/g, '&reg;')        // ®
    .replace(/©/g, '&copy;');      // ©
}

function mdToHtml(md) {
  if (!md || typeof md !== 'string') return '';

  // Normalize special chars first (fixes em-dash ? bug)
  md = normalizeSpecialChars(md);

  // Already HTML — pass through
  if (md.trim().startsWith('<')) return md.trim();

  const lines = md.split('\n');
  const blocks = [];
  let currentPara = [];

  const flushPara = () => {
    if (currentPara.length > 0) {
      const text = currentPara.join(' ').trim();
      if (text) blocks.push(`<p>${text}</p>`);
      currentPara = [];
    }
  };

  const inlineFormat = (text) =>
    text
      .replace(/\*\*(.+?)\*\*/g,  '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,      '<em>$1</em>')
      .replace(/`(.+?)`/g,        '<code>$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Blank line → flush paragraph
    if (line.trim() === '') {
      flushPara();
      continue;
    }

    // Headings
    const h4 = line.match(/^#### (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h1 = line.match(/^# (.+)$/);
    if (h4) { flushPara(); blocks.push(`<h4>${inlineFormat(h4[1])}</h4>`); continue; }
    if (h3) { flushPara(); blocks.push(`<h3>${inlineFormat(h3[1])}</h3>`); continue; }
    if (h2) { flushPara(); blocks.push(`<h2>${inlineFormat(h2[1])}</h2>`); continue; }
    if (h1) { flushPara(); blocks.push(`<h1>${inlineFormat(h1[1])}</h1>`); continue; }

    // Unordered list
    const li = line.match(/^[-*] (.+)$/);
    if (li) {
      flushPara();
      // Collect consecutive list items
      const items = [inlineFormat(li[1])];
      while (i + 1 < lines.length && /^[-*] /.test(lines[i + 1])) {
        i++;
        items.push(inlineFormat(lines[i].replace(/^[-*] /, '')));
      }
      blocks.push(`<ul>${items.map(it => `<li>${it}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list
    const oli = line.match(/^\d+\. (.+)$/);
    if (oli) {
      flushPara();
      const items = [inlineFormat(oli[1])];
      while (i + 1 < lines.length && /^\d+\. /.test(lines[i + 1])) {
        i++;
        items.push(inlineFormat(lines[i].replace(/^\d+\. /, '')));
      }
      blocks.push(`<ol>${items.map(it => `<li>${it}</li>`).join('')}</ol>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      flushPara();
      blocks.push(`<blockquote><p>${inlineFormat(line.slice(2))}</p></blockquote>`);
      continue;
    }

    // Regular text — accumulate into paragraph
    currentPara.push(inlineFormat(line));
  }

  flushPara();
  return blocks.join('\n');
}

// ── WordPress REST API ────────────────────────────────────────────────────────
// publishStatus: "draft" (safe default) or "publish" (once smoke test passes)

// SEO title: short, keyword-front, branded. Format: "{service} {city} WI | Geo Carpentry"
// Strips " in ", ", WI" → " WI", and drops trailing "LLC General Contractor".
// e.g. "Kitchen Remodeling in Green Bay, WI | Geo Carpentry LLC General Contractor"
//   →  "Kitchen Remodeling Green Bay WI | Geo Carpentry"
function generateSeoTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s+in\s+/i, ' ')
    .replace(/,\s*WI/i, ' WI')
    .replace(/\s*\|\s*Geo Carpentry LLC General Contractor\s*$/i, ' | Geo Carpentry')
    .replace(/\s+/g, ' ')
    .trim();
}

async function publishToWP(wpConfig, row, publishStatus = 'draft') {
  const { url: wpUrl, username, appPassword } = wpConfig;
  const f = row.fields;

  const title          = f.title           || 'Untitled';
  const bodyHtml       = mdToHtml(f.body_md || '');
  const slug           = f.slug            || undefined;
  const excerpt        = f.meta_description || '';
  const focusKeyword   = f.target_keyword  || '';
  const metaDesc       = f.meta_description || '';
  const seoTitle       = generateSeoTitle(title);

  const authHeader = 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');

  const postBody = {
    title,
    content: bodyHtml,
    status: publishStatus,
    ...(slug ? { slug } : {}),
    excerpt,
    // SureRank SEO meta fields — silently ignored if SureRank not installed
    meta: {
      _surerank_focus_keyword: focusKeyword,
      _surerank_description:   metaDesc.slice(0, 155),
      _surerank_title:         seoTitle,
    },
  };

  const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    const raw = await res.text().catch(() => '');
    throw new Error(`WP API non-JSON response ${res.status}: ${raw.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(
      `WP API error ${res.status}: ${data.message || JSON.stringify(data).slice(0, 300)}`
    );
  }

  return { id: data.id, link: data.link };
}

// ── Telegram ──────────────────────────────────────────────────────────────────
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[Eli] Telegram not configured — skipping notification.');
    return;
  }
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    TELEGRAM_CHAT_ID,
          text:       message,
          parse_mode: 'HTML',
        }),
      }
    );
  } catch (e) {
    console.warn('[Eli] Telegram send failed:', e.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[Eli] Starting — tenant: ${TENANT_SLUG}, mode: ${MODE}, max: ${MAX_POSTS}`);

  // Gate on mode
  if (MODE !== 'publish_batch') {
    console.log(`[Eli] Mode "${MODE}" is not implemented. Nothing to do.`);
    return;
  }

  // 1. Load local tenant JSON (for name/meta, future use)
  let tenantConfig;
  try {
    tenantConfig = loadTenantConfig(TENANT_SLUG);
    console.log(`[Eli] Tenant config loaded: ${tenantConfig.name || TENANT_SLUG}`);
  } catch (e) {
    // Non-fatal: continue without local config
    console.warn(`[Eli] Warning: ${e.message}`);
    tenantConfig = { name: TENANT_SLUG };
  }

  // 2. Fetch WP credentials from Supabase vault (via CC's Vercel endpoint)
  let wpConfig;
  try {
    wpConfig = await fetchWPCredentials(TENANT_SLUG);
    console.log(`[Eli] WP credentials loaded: ${wpConfig.url} / user: ${wpConfig.username}`);
  } catch (e) {
    const msg = `❌ <b>Eli no puede arrancar</b> — error al leer credenciales del vault.\n<code>${e.message}</code>`;
    console.error('[Eli] Vault error:', e.message);
    await sendTelegram(msg);
    process.exit(1);
  }

  // 3. Fetch pending rows from Content_Queue
  let rows;
  try {
    rows = await fetchContentQueue(TENANT_SLUG, MAX_POSTS);
    console.log(`[Eli] Found ${rows.length} row(s) with status="ready_to_publish"`);
  } catch (e) {
    const msg = `❌ <b>Eli — error Airtable</b>: ${e.message}`;
    console.error('[Eli] Airtable error:', e.message);
    await sendTelegram(msg);
    process.exit(1);
  }

  // 4. Nothing to publish
  if (rows.length === 0) {
    console.log('[Eli] No rows ready to publish. Exiting cleanly.');
    await sendTelegram(
      `ℹ️ <b>Eli (Escriba)</b>: No hay posts listos para publicar en <b>${TENANT_SLUG}</b>.`
    );
    return;
  }

  // 5. Publish each row
  let published = 0;
  let failed    = 0;

  for (const row of rows) {
    const recordId  = row.id;
    const postTitle = row.fields?.title || recordId;

    console.log(`[Eli] Processing: "${postTitle}" (${recordId})`);

    try {
      const { id: wpId, link: wpLink } = await publishToWP(wpConfig, row, 'publish');

      await updateAirtableRow(recordId, {
        status:       'published',
        wp_post_id:   String(wpId),
        wp_url:       wpLink,
        published_at: new Date().toISOString(),
      });

      await sendTelegram(
        `✅ <b>Eli publicó borrador:</b> "${postTitle}"\n` +
        `🔗 <a href="${wpLink}">Ver en WordPress</a>\n` +
        `📋 WP Post ID: <code>${wpId}</code>`
      );

      console.log(`[Eli] ✅ Published: "${postTitle}" → WP ID ${wpId}`);
      published++;

    } catch (e) {
      console.error(`[Eli] ❌ Failed: "${postTitle}" — ${e.message}`);

      try {
        await updateAirtableRow(recordId, {
          status:         'publish_failed',
          last_error:     e.message.slice(0, 250),
          last_error_at:  new Date().toISOString(),
        });
      } catch (updateErr) {
        console.error('[Eli] ❌ Could not update Airtable row either:', updateErr.message);
      }

      await sendTelegram(
        `❌ <b>Eli falló al publicar:</b> "${postTitle}"\n` +
        `Error: <code>${e.message.slice(0, 250)}</code>\n` +
        `Record: <code>${recordId}</code>`
      );

      failed++;
    }
  }

  // 6. Summary
  console.log(`[Eli] Done — published: ${published}, failed: ${failed}`);

  if (published > 0 && failed === 0) {
    await sendTelegram(
      `📝 <b>Eli (Escriba) — sesión completa</b>\n` +
      `✅ Publicados: ${published} borrador(es) en geocarpentry.com\n` +
      `⚠️ Revisalos en WP Admin antes de publicar.`
    );
  } else if (failed > 0) {
    await sendTelegram(
      `⚠️ <b>Eli — sesión con errores</b>\n` +
      `✅ ${published} publicado(s) · ❌ ${failed} fallido(s)\n` +
      `Revisa Airtable Content_Queue → status "publish_failed".`
    );
  }
}

main().catch(async (err) => {
  console.error('[Eli] Fatal unhandled error:', err.message);
  await sendTelegram(`❌ <b>Eli — error fatal</b>: <code>${err.message.slice(0, 300)}</code>`);
  process.exit(1);
});
