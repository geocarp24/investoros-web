#!/usr/bin/env bash
# ============================================================
# export_agents_to_investoros.sh
#
# Copia TODOS los agentes de este repo (alex-real-estate-system) al
# repo geocarp24/investoros-web bajo el directorio `agents/`, listos
# para reorganizar como servicios independientes del SaaS multi-tenant.
#
# QUÉ COPIA (archivos productivos, sin memorias ni colas internas):
#   - Prompts de sub-agentes (.md): scout, matematico, fact-checker, tracy,
#     social_media, creativo, director, programador, secretario.
#   - Código de sub-agentes en carpetas: analista, analitico, auditor,
#     cartografo, cazador, clasificador, creativo, creativo_runner,
#     director_v2, escriba, espia, mercader, oraculo, oraculo_inputs,
#     posicionador.
#   - Infraestructura compartida: _shared/, _setup/, PROTOCOLO_EJECUCION.md,
#     airtable.md, model_assignment.py, model_router_config.json,
#     airtable_escalation_logger.py.
#
# QUÉ NO COPIA (privado / generado runtime):
#   - memoria_*.md (memoria operacional con secrets implícitos)
#   - shared_conversation.json (historial cross-channel)
#   - claude_inbox.json / claude_outbox.json (colas de mensajes)
#   - cola_mensajes.md
#   - audit_meta/ (audit logs por sesión)
#   - node_modules, runs/, *.log
#
# USO:
#   bash scripts/export_agents_to_investoros.sh [destination_clone_path]
#
# Si destination_clone_path no se da, clona en ~/code/investoros-web (default).
# El script crea una branch nueva `import/agents-from-alex-YYYY-MM-DD`, hace
# commit, y opcionalmente pushea (pregunta antes).
# ============================================================

set -euo pipefail

SOURCE_DIR="$(git rev-parse --show-toplevel)"
DEST_DIR="${1:-$HOME/code/investoros-web}"
TIMESTAMP=$(date +%Y-%m-%d)
BRANCH_NAME="import/agents-from-alex-${TIMESTAMP}"
REPO_URL="https://github.com/geocarp24/investoros-web.git"

echo "============================================================"
echo "  EXPORT AGENTS → investoros-web"
echo "============================================================"
echo "  Source:      $SOURCE_DIR"
echo "  Destination: $DEST_DIR"
echo "  Branch:      $BRANCH_NAME"
echo "============================================================"
echo ""

# ── 1. Clonar destino si no existe ───────────────────────
if [ ! -d "$DEST_DIR" ]; then
  echo "[1/5] Clonando investoros-web..."
  mkdir -p "$(dirname "$DEST_DIR")"
  git clone "$REPO_URL" "$DEST_DIR"
else
  echo "[1/5] Destino existe, haciendo pull..."
  cd "$DEST_DIR"
  git checkout main 2>/dev/null || git checkout master 2>/dev/null || true
  git pull --rebase
fi

cd "$DEST_DIR"

# ── 2. Crear branch de import ────────────────────────────
echo ""
echo "[2/5] Creando branch $BRANCH_NAME..."
git checkout -B "$BRANCH_NAME"

# ── 3. Crear estructura agents/ ──────────────────────────
echo ""
echo "[3/5] Creando estructura agents/ en investoros-web..."
mkdir -p agents

# ── 4. Copiar archivos productivos con rsync (excluye basura) ──
echo ""
echo "[4/5] Copiando agentes con rsync (excluye memoria, runs, node_modules)..."

# Sub-agent prompt files (.md) en agents/ raíz
AGENT_MD_FILES=(
  "scout.md" "scout.agent.md"
  "matematico.md" "matematico.agent.md"
  "fact-checker.md" "fact-checker.agent.md"
  "tracy.md"
  "social_media.md"
  "creativo.md"
  "director.md"
  "programador.md"
  "secretario.md"
  "airtable.md"
  "PROTOCOLO_EJECUCION.md"
  "protocolo_seguro.md"
  "AGENTS.md"
  "CLAUDE.md"
  "canva_templates.md"
  "cloudinary_config.md"
  "MODEL_CONFIG.yaml"
  "VALIDATION_DASHBOARD.md"
)

for f in "${AGENT_MD_FILES[@]}"; do
  if [ -f "$SOURCE_DIR/agents/$f" ]; then
    cp "$SOURCE_DIR/agents/$f" "agents/$f"
    echo "  ✓ $f"
  fi
done

# Python infra files
PYTHON_FILES=(
  "model_assignment.py"
  "model_router_config.json"
  "airtable_escalation_logger.py"
  "alerta_telegram.sh"
)

for f in "${PYTHON_FILES[@]}"; do
  if [ -f "$SOURCE_DIR/agents/$f" ]; then
    cp "$SOURCE_DIR/agents/$f" "agents/$f"
    echo "  ✓ $f"
  fi
done

# Sub-agent directories (.mjs code + assets)
AGENT_DIRS=(
  "_shared" "_setup"
  "analista" "analitico" "auditor"
  "cartografo" "cazador" "clasificador"
  "creativo" "creativo_runner"
  "director_v2"
  "escriba" "espia" "mercader"
  "oraculo" "oraculo_inputs"
  "posicionador"
  "tenants"
)

for d in "${AGENT_DIRS[@]}"; do
  if [ -d "$SOURCE_DIR/agents/$d" ]; then
    rsync -a \
      --exclude='node_modules' \
      --exclude='runs/' \
      --exclude='*.log' \
      --exclude='secrets/' \
      --exclude='.cache/' \
      "$SOURCE_DIR/agents/$d/" "agents/$d/"
    echo "  ✓ $d/"
  fi
done

# ── 5. Generar AGENTS_INDEX.md (tabla de qué hace cada uno) ──
echo ""
echo "[5/5] Generando agents/AGENTS_INDEX.md..."
cat > agents/AGENTS_INDEX.md <<'INDEXEOF'
# Agentes — Índice consolidado

Importados desde `geocarp24/alex-real-estate-system` el __TIMESTAMP__.

## 🏠 Análisis de inversión inmobiliaria

| Agente | Archivos | Función |
|---|---|---|
| El Scout | `scout.md`, `scout.agent.md` | Market research — comps, tendencias zip-code |
| El Matemático | `matematico.md`, `matematico.agent.md` | Financial underwriting — ARV, rehab, ROI, cap rate |
| El Fact-Checker | `fact-checker.md`, `fact-checker.agent.md` | Auditoría + Confidence Score 1-10 |
| Tracy | `tracy.md` | Skip Tracing via Tracerfy |

## 📱 Pipeline Social Media

| Agente | Archivos | Función |
|---|---|---|
| Social Media Manager | `social_media.md` | Genera ideas, captions ES/EN, hashtags |
| El Oráculo | `oraculo/oraculo.mjs` | Quality gate — aprueba o rechaza ideas |
| El Creativo | `creativo/creativo.mjs` + `creativo_runner/themes.mjs` | Render PNG carruseles via Puppeteer + HTML/CSS (5 temas T1-T5) |
| El Director v2 | `director_v2/director_v2.mjs` | Render Reels 15s, 5 slides × 3s |
| El Programador | `programador.md` | Publish a FB+IG via Meta Graph API |

## 🔍 Lead Generation / Ops (GHA crons)

| Agente | Archivo | Función |
|---|---|---|
| El Cartógrafo | `cartografo/mcp_server` | MCP server compartido |
| El Espía | `espia/espia.mjs` | Scraping fuentes externas (probate, foreclosure) |
| El Cazador | `cazador/cazador.mjs` | Identifica leads cualificados |
| El Clasificador | `clasificador/clasificador.mjs` | Categoriza por estrategia (F&F, BRRRR, Wholesale) |
| El Analista | `analista/analista.mjs` | Análisis cuantitativo de leads + mercado |
| El Mercader | `mercader/mercader.mjs` | Underwriting de deals en pipeline |
| El Posicionador | `posicionador/posicionador.mjs` | SEO + content positioning |

## 🎯 Quality & Audit

| Agente | Archivo | Función |
|---|---|---|
| El Auditor | `auditor/auditor.mjs` | Audita decisiones de otros agentes |
| El Analítico | `analitico/analitico.mjs` + `audit_scoring.mjs` | Métricas + scoring post-execution |
| El Escriba | `escriba/escriba.mjs` | Logs estructurados de runs |

## 📞 Comunicación con leads

| Agente | Archivos | Función |
|---|---|---|
| El Secretario | `secretario.md` | Email + calendar |
| Fer (PHP, en hostinger/tools/) | `fer_agent.php`, etc. | SMS outbound + auto-reply inbound — actualmente PAUSADO por kill-switch |

## 🔧 Infraestructura compartida

| Archivo | Para qué |
|---|---|
| `PROTOCOLO_EJECUCION.md` | 7 fases obligatorias para toda operación no trivial |
| `protocolo_seguro.md` | Autonomía + seguridad (anti-prompt-injection) |
| `airtable.md` | Mapa completo de campos de tablas Airtable |
| `model_assignment.py` | Smart escalation Haiku→Sonnet→Opus por agente |
| `model_router_config.json` | Config centralizada de routing por tarea |
| `_shared/` | Tools compartidos (sm_tables.mjs, etc.) |
| `MODEL_CONFIG.yaml` | Config legacy (compatibilidad) |
| `VALIDATION_DASHBOARD.md` | KPIs de validación de outputs |

## ⚠️ NO importado (intencional)

- `memoria_*.md` — memoria operacional (privada por tenant)
- `shared_conversation.json` — historial cross-channel
- `claude_inbox.json` / `claude_outbox.json` — colas runtime
- `audit_meta/` — audit logs por sesión
- `cola_mensajes.md` — mensajería inter-agente runtime
- `node_modules/`, `runs/`, `*.log` — generados runtime

Regenerar memoria via `bash scripts/build_tenant_context.sh <tenant>` desde el repo origen.
INDEXEOF

# Reemplazar __TIMESTAMP__
sed -i "s/__TIMESTAMP__/$(date -u +'%Y-%m-%d %H:%M UTC')/" agents/AGENTS_INDEX.md

# ── 6. Commit ──────────────────────────────────────────
echo ""
echo "[Commit] Staging changes..."
git add agents/
git status --short | head -20

echo ""
read -p "  ¿Hacer commit y push? (y/N): " CONFIRM
if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
  git commit -m "import: agents from alex-real-estate-system

Importa el sistema completo de sub-agentes (21 agentes) desde
geocarp24/alex-real-estate-system para servir como base del SaaS
multi-tenant. Incluye:

- Prompts de sub-agentes (.md): Scout, Matemático, Fact-Checker, Tracy,
  Social Media Manager, Creativo, Director, Programador, Secretario.
- Código de agentes operativos (.mjs): Analista, Analítico, Auditor,
  Cartógrafo, Cazador, Clasificador, Creativo, Director v2, Escriba,
  Espía, Mercader, Oráculo, Posicionador.
- Infraestructura compartida: _shared/, _setup/, PROTOCOLO_EJECUCION,
  protocolo_seguro, airtable, model_assignment, model_router_config.
- AGENTS_INDEX.md: tabla consolidada de qué hace cada agente.

NO incluye memorias ni colas runtime (regenerable por tenant)."

  git push -u origin "$BRANCH_NAME"
  echo ""
  echo "✅ Push completo. Abre el PR en:"
  echo "   https://github.com/geocarp24/investoros-web/compare/$BRANCH_NAME?expand=1"
else
  echo ""
  echo "ℹ️  Cambios staged pero NO commiteados ni pusheados."
  echo "    Inspecciona en: $DEST_DIR"
  echo "    Cuando estés listo:"
  echo "      cd $DEST_DIR && git commit && git push -u origin $BRANCH_NAME"
fi

echo ""
echo "============================================================"
echo "✅ Export completo a $DEST_DIR"
echo "============================================================"
