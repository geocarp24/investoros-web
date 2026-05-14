/**
 * scraper_client.mjs — HTTP client with retry + rate limiting for El Rastreador.
 *
 * For most public gov records and APIs (WI Circuit Court, Reddit JSON, county tax
 * delinquent pages), simple fetch + HTML parse is enough. Firecrawl is reserved
 * for JS-heavy or anti-bot pages (TBD).
 *
 * Sprint F2.2.b (Jorge 2026-05-08).
 */

const DEFAULT_USER_AGENT = "Pinnacle Holdings Research Bot 1.0 (deals@pinnaclegroupwi.com)";
const DEFAULT_TIMEOUT_MS = 20000;

let _fetch = globalThis.fetch;
export function __setFetch(fn) { _fetch = fn; }

/**
 * Sleep helper.
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Fetch a URL with retry + rate-limit aware backoff.
 *
 * @param {string} url
 * @param {object} opts
 * @param {number} [opts.attempts=3]
 * @param {number} [opts.baseDelayMs=1000]
 * @param {number} [opts.timeoutMs=20000]
 * @param {string} [opts.userAgent]
 * @param {string} [opts.accept]
 * @returns {Promise<{status:number, headers:object, body:string}>}
 */
export async function fetchWithRetry(url, opts = {}) {
  const {
    attempts = 3,
    baseDelayMs = 1000,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    userAgent = DEFAULT_USER_AGENT,
    accept = "text/html,application/json",
  } = opts;

  if (!url || typeof url !== "string") throw new Error("url required");

  let lastErr = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await _fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": userAgent,
          "Accept": accept,
          "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        },
      });
      clearTimeout(timer);

      // Honor 429 Retry-After
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "60", 10);
        if (attempt < attempts) {
          await sleep(Math.min(retryAfter * 1000, 120000));
          continue;
        }
      }

      const body = await res.text();
      const headers = {};
      if (typeof res.headers?.forEach === "function") {
        res.headers.forEach((v, k) => { headers[k] = v; });
      } else if (res.headers && typeof res.headers === "object") {
        Object.assign(headers, res.headers);
      }
      return { status: res.status, headers, body };
    } catch (e) {
      lastErr = e;
      if (attempt < attempts) {
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }
  throw new Error(`fetch failed after ${attempts} attempts: ${lastErr?.message || "unknown"}`);
}

/**
 * Check robots.txt allows our user agent on a given URL path.
 * Returns { allowed: bool, reason?: string }.
 *
 * Best-effort parser — handles `User-agent: *` + `Disallow:` directives.
 * For complex robots.txt with explicit bot-name allows, falls back to permissive.
 */
export async function checkRobotsAllowed(url, opts = {}) {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const { status, body } = await fetchWithRetry(robotsUrl, { ...opts, attempts: 1, timeoutMs: 5000 });
    if (status !== 200) return { allowed: true, reason: `robots.txt returned ${status} (assuming allowed)` };

    // Parse — find User-agent: * block, look for Disallow: paths
    const lines = body.split(/\r?\n/);
    let inStarBlock = false;
    const disallowed = [];
    for (const raw of lines) {
      const line = raw.split("#")[0].trim();
      if (!line) continue;
      const [keyRaw, ...valParts] = line.split(":");
      if (!keyRaw || valParts.length === 0) continue;
      const key = keyRaw.trim().toLowerCase();
      const val = valParts.join(":").trim();
      if (key === "user-agent") {
        inStarBlock = val === "*";
      } else if (inStarBlock && key === "disallow" && val) {
        disallowed.push(val);
      }
    }
    const path = u.pathname + u.search;
    for (const d of disallowed) {
      if (path.startsWith(d)) {
        return { allowed: false, reason: `robots.txt disallows ${d}` };
      }
    }
    return { allowed: true };
  } catch (e) {
    return { allowed: true, reason: `robots check failed: ${e.message} (assuming allowed)` };
  }
}

/**
 * Extract first match of a regex pattern from text.
 */
export function extractFirst(text, pattern) {
  if (!text || !pattern) return null;
  const m = String(text).match(pattern);
  return m ? (m[1] !== undefined ? m[1] : m[0]).trim() : null;
}

/**
 * Extract all matches from text.
 */
export function extractAll(text, pattern) {
  if (!text || !pattern) return [];
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const re = new RegExp(pattern.source, flags);
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1] !== undefined ? m[1] : m[0]);
  }
  return out;
}
