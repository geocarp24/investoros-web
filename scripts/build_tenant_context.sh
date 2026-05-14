#!/usr/bin/env bash
# ============================================================
# build_tenant_context.sh
#
# Genera un bundle Markdown por tenant para subir a Claude Projects.
# Cada bundle incluye:
#   1. Reglas globales (CLAUDE.md + protocolos) — comunes a todos
#   2. Config específica del tenant (agents/tenants/<slug>/*)
#   3. Memoria filtrada por menciones del tenant (block-level)
#
# Uso:
#   bash scripts/build_tenant_context.sh <tenant-slug> [alias1] [alias2] ...
#
# Ejemplos:
#   bash scripts/build_tenant_context.sh pinnacle "Pinnacle" "pinnaclegroupwi"
#   bash scripts/build_tenant_context.sh geo-carpentry "Geo Carpentry" "GeoCarpentry"
#   bash scripts/build_tenant_context.sh fc-multiservices "FC Multiservices" "FC Multi"
# ============================================================

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [ $# -lt 1 ]; then
  echo "usage: $0 <tenant-slug> [alias1] [alias2] ..." >&2
  exit 1
fi

TENANT_SLUG="$1"
shift

ALIASES=("$TENANT_SLUG")
[ $# -gt 0 ] && ALIASES+=("$@")

ALIAS_REGEX=""
for alias in "${ALIASES[@]}"; do
  if [ -z "$ALIAS_REGEX" ]; then
    ALIAS_REGEX="$alias"
  else
    ALIAS_REGEX="$ALIAS_REGEX|$alias"
  fi
done

TENANT_UPPER=$(echo "$TENANT_SLUG" | tr '[:lower:]-' '[:upper:]_')
OUT="${TENANT_UPPER}_PROJECT_CONTEXT.md"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

GLOBAL_SOURCES=("CLAUDE.md" "agents/PROTOCOLO_EJECUCION.md" "agents/protocolo_seguro.md")
FILTERED_SOURCES=("memoria_ALex.md" "agents/memoria_alex.md" "agents/memoria_social_media.md" "telegram_bot/telegram_memory.md")

cat > "$OUT" <<HEADER
# ${TENANT_UPPER//_/ } — Project Knowledge Bundle

**Auto-generated** — do NOT edit by hand.
**Regenerate:** \`bash scripts/build_tenant_context.sh $TENANT_SLUG ${ALIASES[@]:1}\`

- **Tenant slug:** \`$TENANT_SLUG\`
- **Aliases buscados:** ${ALIASES[*]}
- **Last generated:** $TIMESTAMP

> ⚠️ Secrets REDACTED. For real credentials see local \`.env\` / Doppler / config.php.

## Cómo usar este bundle

Subir a Claude Projects (claude.ai/projects) como Project Knowledge del proyecto
**${TENANT_UPPER//_/ }**. Custom instructions sugerido:

> Eres ALEX trabajando en el contexto del tenant **$TENANT_SLUG**. Lee SIEMPRE el
> Project Knowledge. Idioma español. Modo /GOD activo. Sección 1 = reglas globales;
> Secciones 2-3 = específicas a este tenant.

---

HEADER

{
  echo ""
  echo "## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "## SECCIÓN 1 — Reglas Globales (aplican a todos)"
  echo "## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
} >> "$OUT"

for src in "${GLOBAL_SOURCES[@]}"; do
  if [ -f "$src" ]; then
    { echo ""; echo "### SOURCE: \`$src\` (full)"; echo ""; cat "$src"; echo ""; } >> "$OUT"
  fi
done

{
  echo ""
  echo "## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "## SECCIÓN 2 — Config Específica del Tenant"
  echo "## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
} >> "$OUT"

TENANT_DIR="agents/tenants/$TENANT_SLUG"
TENANT_JSON="agents/tenants/${TENANT_SLUG}.json"
TENANT_FILES_FOUND=0

if [ -d "$TENANT_DIR" ]; then
  while IFS= read -r -d '' f; do
    { echo ""; echo "### SOURCE: \`$f\` (full)"; echo ""; echo '```'; cat "$f"; echo '```'; echo ""; } >> "$OUT"
    TENANT_FILES_FOUND=$((TENANT_FILES_FOUND + 1))
  done < <(find "$TENANT_DIR" -type f -print0)
fi

if [ -f "$TENANT_JSON" ]; then
  { echo ""; echo "### SOURCE: \`$TENANT_JSON\` (full)"; echo ""; echo '```json'; cat "$TENANT_JSON"; echo '```'; echo ""; } >> "$OUT"
  TENANT_FILES_FOUND=$((TENANT_FILES_FOUND + 1))
fi

[ $TENANT_FILES_FOUND -eq 0 ] && echo "_No tenant-specific files found in \`$TENANT_DIR/\` or \`$TENANT_JSON\`._" >> "$OUT"

{
  echo ""
  echo "## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "## SECCIÓN 3 — Memoria Operacional Filtrada"
  echo "## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "**Filtros aplicados:** \`$ALIAS_REGEX\` (case-insensitive)"
  echo "**Heurística:** bloques (delimitados por línea vacía) que mencionen cualquier alias."
  echo ""
} >> "$OUT"

filter_blocks_by_aliases() {
  awk -v aliases="$ALIAS_REGEX" '
    BEGIN { IGNORECASE = 1; RS = ""; ORS = "\n\n" }
    { if ($0 ~ aliases) print }
  ' "$1"
}

FILTERED_BLOCKS=0
for src in "${FILTERED_SOURCES[@]}"; do
  if [ -f "$src" ]; then
    FILTERED=$(filter_blocks_by_aliases "$src")
    if [ -n "$FILTERED" ]; then
      BC=$(echo "$FILTERED" | grep -c '^' || true)
      { echo ""; echo "### SOURCE: \`$src\` (filtered)"; echo ""; echo "$FILTERED"; } >> "$OUT"
      FILTERED_BLOCKS=$((FILTERED_BLOCKS + BC))
    fi
  fi
done

[ $FILTERED_BLOCKS -eq 0 ] && echo "_No menciones del tenant encontradas en memorias._" >> "$OUT"

# Sanitize
echo "" >> "$OUT"
echo "Sanitizing..."
SECRETS_FOUND=0

redact() {
  local p="$1" r="$2" lab="$3"
  if grep -qE "$p" "$OUT" 2>/dev/null; then
    local c; c=$(grep -cE "$p" "$OUT" || true)
    sed -i.bak -E "s/$p/$r/g" "$OUT"; rm -f "${OUT}.bak"
    SECRETS_FOUND=$((SECRETS_FOUND + c))
    echo "  ✓ $c $lab"
  fi
}

redact 'pat[A-Za-z0-9]{14}\.[a-f0-9]{40,}' '[REDACTED_AIRTABLE_PAT]' 'Airtable PAT'
redact 'app[A-Za-z0-9]{14}' '[REDACTED_AIRTABLE_BASE_ID]' 'Airtable base ID'
redact 'tbl[A-Za-z0-9]{14}' '[REDACTED_AIRTABLE_TABLE_ID]' 'Airtable table ID'
redact '[0-9]{9,10}:[A-Za-z0-9_-]{35}' '[REDACTED_TELEGRAM_BOT_TOKEN]' 'Telegram token'
redact 'AKIA[A-Z0-9]{16}' '[REDACTED_AWS_ACCESS_KEY]' 'AWS key'
redact 'sk-ant-[A-Za-z0-9_-]+' '[REDACTED_ANTHROPIC_KEY]' 'Anthropic key'
redact 'sk-[A-Za-z0-9_-]{30,}' '[REDACTED_OPENAI_KEY]' 'OpenAI key'
redact 'Bearer [A-Za-z0-9._-]{30,}' 'Bearer [REDACTED_TOKEN]' 'Bearer token'
redact 'sk_live_[A-Za-z0-9]+' '[REDACTED_STRIPE_LIVE_KEY]' 'Stripe live'
redact 'sk_test_[A-Za-z0-9]+' '[REDACTED_STRIPE_TEST_KEY]' 'Stripe test'
redact 'pk_live_[A-Za-z0-9]+' '[REDACTED_STRIPE_LIVE_PUB]' 'Stripe pub'
redact 'cloudinary://[^[:space:]"]+' 'cloudinary://[REDACTED]' 'Cloudinary'

SIZE=$(wc -c < "$OUT" | tr -d ' ')
LINES=$(wc -l < "$OUT" | tr -d ' ')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Generated $OUT (tenant: $TENANT_SLUG)"
echo "  Size: $SIZE bytes ($((SIZE / 1024)) KB), $LINES lines"
echo "  Tenant files: $TENANT_FILES_FOUND  |  Secrets redacted: $SECRETS_FOUND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -qE 'pat[A-Za-z0-9]{14}\.[a-f0-9]|sk-ant-[A-Za-z0-9]|AKIA[A-Z0-9]{16}|Bearer [A-Za-z0-9]{40}' "$OUT"; then
  echo "⚠️  WARNING: residual secret pattern. Inspect $OUT before upload!" >&2
  exit 1
fi
echo "✅ Safe to upload."
