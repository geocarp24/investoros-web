#!/bin/bash
# ============================================================
#  ALEX — Migración de memoria y configuración al VPS
#  Ejecutar en el VPS: bash /opt/alex-bot/vps_migrate_memory.sh
# ============================================================

PROJECT_MEMORY_DIR="/root/.claude/projects/opt-alex-bot/memory"
CLAUDE_DIR="/root/.claude"

echo "============================================================"
echo "  Migrando memoria de Claude Code al VPS..."
echo "============================================================"

# ── Crear estructura de directorios ──────────────────────────
mkdir -p "$PROJECT_MEMORY_DIR"
mkdir -p "$CLAUDE_DIR"

# ── MEMORY INDEX ─────────────────────────────────────────────
cat > "$PROJECT_MEMORY_DIR/MEMORY.md" << 'EOF'
# MEMORY INDEX

- [project_alex_system.md](project_alex_system.md) — ALEX multi-agent system architecture and file locations
- [project_geo_carpentry.md](project_geo_carpentry.md) — Geo Carpentry LLC Budget Builder app, Jorge Cruz profile, working directory
EOF

# ── MEMORY: ALEX System ──────────────────────────────────────
cat > "$PROJECT_MEMORY_DIR/project_alex_system.md" << 'EOF'
---
name: ALEX Multi-Agent System Architecture
description: The ALEX real estate investment analysis system is fully wired — CLAUDE.md activates ALEX identity, agents/ folder has 3 sub-agent prompts, memoria_ALex.md stores persistent deal memory
type: project
---

The ALEX 4-agent system is implemented and active in this project.

**Why:** User built a real estate investment analysis system with 4 specialized AI agents for Fix & Flip, BRRRR, Buy & Hold, Wholesale, and Multifamily strategies focused on Wisconsin.

**How to apply:** Every session in this project should start as ALEX (Orchestrator). Use Agent tool to spawn El Scout, El Matemático, and El Fact-Checker sub-agents when analyzing deals.

## File Map
- `CLAUDE.md` — ALEX identity + orchestrator instructions (auto-loaded every session)
- `memoria_ALex.md` — Persistent deal memory (read at session start, write after each deal)
- `agents/scout.md` — El Scout sub-agent prompt (market research via WebSearch/WebFetch)
- `agents/matematico.md` — El Matemático sub-agent prompt (financial underwriting, JSON output)
- `agents/fact-checker.md` — El Fact-Checker sub-agent prompt (audit + Confidence Score 1-10)

## Agent Invocation Flow
1. El Scout + El Matemático → run in parallel (or Scout first if data needed)
2. El Fact-Checker → runs after both JSONs are available
3. ALEX consolidates all 3 JSONs → presents "ANÁLISIS ESTÁNDAR DE DEAL" to user

## Confidence Score → Decision Rules
- Score < 6: Discard (abort, do not show user)
- Score 6–7: Gather More Data (explain gaps)
- Score 8–9: Proceed (present with risks)
- Score 10: Proceed (active recommendation)
EOF

# ── MEMORY: Geo Carpentry ────────────────────────────────────
cat > "$PROJECT_MEMORY_DIR/project_geo_carpentry.md" << 'EOF'
---
name: project_geo_carpentry
description: Geo Carpentry LLC — Budget Builder App project context and Jorge Cruz profile
type: project
---

Geo Carpentry LLC (S-Corp), Jorge Cruz, Green Bay WI. geocarpentry.com.
Working directory: /opt/geo-carpentry/ (en VPS) / C:\Users\Admin\OneDrive\Documents\Geo Carpentry\ (en PC)

**Why:** Jorge needs a Budget Builder web app for construction quotes — Claude API analyzes PDF plans and fills CSI divisions. App is HTML/JS vanilla widget running inside Claude.ai using window.storage for persistence.

**How to apply:** When working on Geo Carpentry tasks, use the Geo Carpentry folder. Read the full memory file for complete context on the Budget Builder app architecture, pending features, and Jorge's preferences.

Key pending features (priority order):
1. Wisconsin price database (reference costs per material/trade)
2. Auto quote number (GC-2026-XXXX format)
3. Input validation (prevent $0 divisions)
4. Duplicate budget feature
EOF

# ── Settings de Claude Code ───────────────────────────────────
cat > "$CLAUDE_DIR/settings.json" << 'EOF'
{
  "permissions": {
    "allow": [
      "Bash(curl:*)",
      "Bash(git:*)",
      "Bash(python3:*)",
      "Bash(systemctl:*)",
      "Bash(npm:*)",
      "Bash(node:*)"
    ]
  }
}
EOF

echo ""
echo "✅ Memoria migrada correctamente:"
echo "   → $PROJECT_MEMORY_DIR/MEMORY.md"
echo "   → $PROJECT_MEMORY_DIR/project_alex_system.md"
echo "   → $PROJECT_MEMORY_DIR/project_geo_carpentry.md"
echo "   → $CLAUDE_DIR/settings.json"
echo ""
echo "Ahora abre /opt/alex-bot en VS Code y Claude Code"
echo "arrancará como ALEX con toda la memoria."
echo "============================================================"
