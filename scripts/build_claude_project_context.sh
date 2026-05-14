#!/usr/bin/env bash
# ============================================================
# build_claude_project_context.sh
#
# Consolida toda la memoria operacional de ALEX en un solo
# archivo Markdown listo para subir a Claude Projects en
# claude.ai/projects → ALEX / Pinnacle Real Estate.
#
# Sanitiza secrets conocidos (Airtable PAT, Telegram tokens,
# AWS/Anthropic/OpenAI keys, generic Bearer headers) usando
# regex patterns ANTES de escribir el output.
#
# Uso:
#   bash scripts/build_claude_project_context.sh
#
# Re-sync:
#   Cada vez que edites memoria_ALex.md, CLAUDE.md, etc.,
#   re-corre este script y sube el output al Project Knowledge.
# ============================================================

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

OUT="ALEX_PROJECT_CONTEXT.md"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Sources to consolidate (in load-priority order)
SOURCES=(
  "CLAUDE.md"
  "memoria_ALex.md"
  "agents/memoria_alex.md"
  "agents/PROTOCOLO_EJECUCION.md"
  "agents/protocolo_seguro.md"
  "telegram_bot/telegram_memory.md"
)

# ── 1. Build header ──────────────────────────────────────
cat > "$OUT" <<HEADER
# ALEX / Pinnacle Real Estate — Project Knowledge Bundle

**Auto-generated** for Claude Projects upload — do NOT edit by hand.
**Regenerate with:** \`bash scripts/build_claude_project_context.sh\`

- **Last generated:** $TIMESTAMP
- **Tenant:** Pinnacle Holdings Group (tenant cero del SaaS InvestorOS)
- **Stack:** Wisconsin real estate + InvestorOS multi-tenant SaaS
- **Idioma por defecto:** Español (cambiar a inglés solo si Jorge lo pide)

> ⚠️ All secrets (API tokens, base IDs, bot tokens) are REDACTED in this bundle.
> For real credentials, see local \`.env\` / Doppler / config.php (NOT in this file).

---

HEADER

# ── 2. Append each source file ───────────────────────────
for src in "${SOURCES[@]}"; do
  if [ -f "$src" ]; then
    echo "" >> "$OUT"
    echo "" >> "$OUT"
    echo "## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$OUT"
    echo "## SOURCE: \`$src\`" >> "$OUT"
    echo "## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$OUT"
    echo "" >> "$OUT"
    cat "$src" >> "$OUT"
  else
    echo "  ⚠️  Source not found, skipping: $src" >&2
  fi
done

# ── 3. Sanitize secrets ─────────────────────────────────
SECRETS_FOUND=0

redact() {
  local pattern="$1"
  local replacement="$2"
  local label="$3"
  if grep -qE "$pattern" "$OUT" 2>/dev/null; then
    local count
    count=$(grep -cE "$pattern" "$OUT" || true)
    sed -i.bak -E "s/$pattern/$replacement/g" "$OUT"
    rm -f "${OUT}.bak"
    echo "  ✓ Redacted $count $label match(es)"
    SECRETS_FOUND=$((SECRETS_FOUND + count))
  fi
}

echo "Sanitizing secrets..."

# Airtable Personal Access Token: pat[14 chars].[40+ hex]
redact 'pat[A-Za-z0-9]{14}\.[a-f0-9]{40,}' '[REDACTED_AIRTABLE_PAT]' 'Airtable PAT'

# Airtable base ID: app[14 chars]
redact 'app[A-Za-z0-9]{14}' '[REDACTED_AIRTABLE_BASE_ID]' 'Airtable base ID'

# Airtable table ID: tbl[14 chars]
redact 'tbl[A-Za-z0-9]{14}' '[REDACTED_AIRTABLE_TABLE_ID]' 'Airtable table ID'

# Telegram bot token: 9-10 digits : 35 chars
redact '[0-9]{9,10}:[A-Za-z0-9_-]{35}' '[REDACTED_TELEGRAM_BOT_TOKEN]' 'Telegram token'

# AWS access key
redact 'AKIA[A-Z0-9]{16}' '[REDACTED_AWS_ACCESS_KEY]' 'AWS access key'

# Anthropic API key
redact 'sk-ant-[A-Za-z0-9_-]+' '[REDACTED_ANTHROPIC_KEY]' 'Anthropic key'

# OpenAI API key
redact 'sk-[A-Za-z0-9_-]{30,}' '[REDACTED_OPENAI_KEY]' 'OpenAI key'

# Generic Bearer token in HTTP headers
redact 'Bearer [A-Za-z0-9._-]{30,}' 'Bearer [REDACTED_TOKEN]' 'Bearer token'

# Stripe keys
redact 'sk_live_[A-Za-z0-9]+' '[REDACTED_STRIPE_LIVE_KEY]' 'Stripe live key'
redact 'sk_test_[A-Za-z0-9]+' '[REDACTED_STRIPE_TEST_KEY]' 'Stripe test key'
redact 'pk_live_[A-Za-z0-9]+' '[REDACTED_STRIPE_LIVE_PUB]' 'Stripe live publishable'

# Cloudinary
redact 'cloudinary://[^[:space:]"]+' 'cloudinary://[REDACTED]' 'Cloudinary URL'

# GitHub PAT classic (ghp_) — 36 chars
redact 'ghp_[A-Za-z0-9]{36}' '[REDACTED_GITHUB_PAT]' 'GitHub PAT (classic)'

# GitHub fine-grained PAT (github_pat_)
redact 'github_pat_[A-Za-z0-9_]{82}' '[REDACTED_GITHUB_FINE_PAT]' 'GitHub PAT (fine-grained)'

# GitHub OAuth token (gho_)
redact 'gho_[A-Za-z0-9]{36}' '[REDACTED_GITHUB_OAUTH]' 'GitHub OAuth token'

# GitHub App / refresh / user token (ghu_, ghs_, ghr_)
redact 'gh[usr]_[A-Za-z0-9]{36}' '[REDACTED_GITHUB_TOKEN]' 'GitHub token'

# HuggingFace token (hf_) — 30+ chars
redact 'hf_[A-Za-z0-9]{30,}' '[REDACTED_HF_TOKEN]' 'HuggingFace token'

# Doppler service token (dp.st.) and personal token (dp.pt.)
redact 'dp\.(st|pt|sa|ct)\.[A-Za-z0-9_.-]+' '[REDACTED_DOPPLER_TOKEN]' 'Doppler token'

# Supabase URL
redact 'https://[a-z0-9]+\.supabase\.(co|in)' '[REDACTED_SUPABASE_URL]' 'Supabase URL'

# Twilio Account SID (AC + 32 hex)
redact 'AC[a-f0-9]{32}' '[REDACTED_TWILIO_SID]' 'Twilio Account SID'

# JWT tokens (3 base64-url segments separated by dots, starting with eyJ — covers Supabase anon/service keys, Tracerfy tokens, generic JWTs)
redact 'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' '[REDACTED_JWT]' 'JWT (Supabase/Tracerfy/generic)'

# Slack tokens (xoxb-, xoxp-, xoxa-)
redact 'xox[bpasr]-[A-Za-z0-9-]{10,}' '[REDACTED_SLACK_TOKEN]' 'Slack token'

# Modal tokens (mt_ or mt-)
redact 'mt[_-][A-Za-z0-9]{20,}' '[REDACTED_MODAL_TOKEN]' 'Modal token'

# Replicate API token (r8_)
redact 'r8_[A-Za-z0-9]{30,}' '[REDACTED_REPLICATE_TOKEN]' 'Replicate token'

# Generic API key with at least 32 chars in named env-var style
redact '(GITHUB_TOKEN|GH_TOKEN|TELEGRAM_TOKEN|AIRTABLE_TOKEN|ANTHROPIC_KEY|OPENAI_KEY|TRACERFY_TOKEN|HEYGEN_API_KEY|HEYGEN_API_TOKEN|MAKE_API_KEY|TWILIO_AUTH_TOKEN|TWILIO_API_KEY|SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY|SUPABASE_KEY|CLERK_SECRET_KEY|CLERK_PUBLISHABLE_KEY|STRIPE_SECRET_KEY|MODAL_TOKEN|HF_TOKEN|HUGGINGFACE_TOKEN|GEMINI_API_KEY|GOOGLE_API_KEY|REPLICATE_API_TOKEN|BLOTATO_TOKEN|BLOTATO_API_KEY|ALEX_SECRET|X-Alex-Secret)[[:space:]]*[:=][[:space:]]*[\"]?[A-Za-z0-9._-]{16,}[\"]?' '\1=[REDACTED]' 'named env-var credential'

# Private key block markers (multi-line redaction requires sed -z; mark begin/end lines)
redact '-----BEGIN PRIVATE KEY-----' '[REDACTED_PRIVATE_KEY_BEGIN]' 'Private key begin marker'
redact '-----END PRIVATE KEY-----' '[REDACTED_PRIVATE_KEY_END]' 'Private key end marker'
redact '-----BEGIN RSA PRIVATE KEY-----' '[REDACTED_RSA_KEY_BEGIN]' 'RSA private key begin'
redact '-----END RSA PRIVATE KEY-----' '[REDACTED_RSA_KEY_END]' 'RSA private key end'

# Google service account client_email
redact '"client_email":[[:space:]]*"[^"]+"' '"client_email": "[REDACTED]"' 'GCP client_email'

# Google service account private_key (JSON field, single-line escaped form)
redact '"private_key":[[:space:]]*"[^"]+"' '"private_key": "[REDACTED]"' 'GCP private_key JSON field'

# Generic 32+ char hex secrets following common label patterns
redact '(SECRET|PASSWORD|TOKEN|API_KEY)[[:space:]]*[:=][[:space:]]*[\"]?[A-Za-z0-9_.-]{20,}[\"]?' '\1=[REDACTED]' 'generic secret'

# ── 4. Final report ─────────────────────────────────────
SIZE=$(wc -c < "$OUT" | tr -d ' ')
LINES=$(wc -l < "$OUT" | tr -d ' ')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Generated $OUT"
echo "  Size: $SIZE bytes ($((SIZE / 1024)) KB), $LINES lines"
echo "  Total secret matches redacted: $SECRETS_FOUND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Open https://claude.ai/projects"
echo "  2. Go to: ALEX / Pinnacle Real Estate (or create it)"
echo "  3. Project Knowledge → upload $OUT"
echo "  4. Re-sync after every memory edit by re-running this script"
echo ""

# ── 5. Final safety check — warn if any common secret pattern survived ─
if grep -qE 'pat[A-Za-z0-9]{14}\.|sk-ant-[A-Za-z0-9]|AKIA[A-Z0-9]|Bearer [A-Za-z0-9]{30}|ghp_[A-Za-z0-9]{30}|github_pat_[A-Za-z0-9]|hf_[A-Za-z0-9]{30}|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|AC[a-f0-9]{32}|xox[bpasr]-|dp\.(st|pt|sa|ct)\.|r8_[A-Za-z0-9]{30}|BEGIN[[:space:]](RSA[[:space:]])?PRIVATE[[:space:]]KEY' "$OUT"; then
  echo "⚠️  WARNING: file may still contain unredacted secret patterns. Inspect manually before upload!" >&2
  echo "Run: grep -nE 'pat[A-Za-z0-9]{14}\.|sk-ant-|AKIA|Bearer [A-Za-z0-9]{30}|ghp_|github_pat_|hf_|eyJ.*\.eyJ.*\..*|AC[a-f0-9]{32}|xox|dp\.(st|pt)|r8_|BEGIN.*PRIVATE.*KEY' \"$OUT\" | head -20  # to inspect" >&2
  exit 1
fi

echo "✅ Safety check passed — file is safe to upload."
