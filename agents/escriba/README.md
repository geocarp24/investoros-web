# El Escriba — Content Writer Sub-Sub-Agent

**Sub-sub-agente bajo El Posicionador.** Escribe blogs, news, Q&A pages, pillar pages para llenar los SEO gaps detectados, atraer backlinks, y construir autoridad estatal del tenant.

Jerarquía R9:
```
El Posicionador (SEO monitor)       ← identifica qué falta
    └── El Escriba (content writer)  ← este agente: escribe qué llena el hueco
```

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Anthropic skill spec + Identity + hierarchy + 4 modes + Content_Queue schema |
| `escriba.mjs` | Node orchestrator — same architecture pattern as Mercader/Posicionador |
| `runs/` | Raw MD outputs per run |

## 4 Modos

### `atp_mine` (mensual, día 1)
Brainstorm estilo AnswerThePublic desde `tenant.content_goals.atp_mining.seed_queries`. Default usa conocimiento de Claude; si `fallback_browser=true` cae a gstack `/browse` sobre ATP real. Output: tabla de 50-100 preguntas priorizadas. Status: `Research`.

### `plan_week` (lunes, tras El Posicionador)
Lee último SEO_Audit + ATP questions + topic_pillars → prioriza por gap severity + backlink potential → genera calendario de `articles_per_week` artículos. Status: `Planned`. Alerta Telegram.

### `draft_article` (martes-jueves)
Toma un artículo con status=Planned → redacta body completo MD (EN + ES si tenant lo habilita) + metadata + schema JSON-LD + internal links + external citations. Status: `Review`. Alerta Telegram. Si `content_goals.publish_to_wordpress=true` → llama `pinnacle_wp_bridge.php` action=`create_post` status=`draft` para que el Jefe revise en WP directo.

### `on_demand`
ALEX dice "escribí un artículo sobre X" → salta el calendario, arma article object on-the-fly con `--title` y `--target-keyword`, va directo a draft.

## Local testing (dry-run — no subprocess, no Airtable, no Telegram, no WP)

```bash
node agents/escriba/escriba.mjs --tenant pinnacle --mode atp_mine --dry-run
node agents/escriba/escriba.mjs --tenant pinnacle --mode plan_week --dry-run
node agents/escriba/escriba.mjs --tenant pinnacle --mode draft_article --title "How to stop foreclosure in Milwaukee" --target-keyword "stop foreclosure milwaukee" --dry-run
node agents/escriba/escriba.mjs --tenant pinnacle --mode on_demand --title "X" --target-keyword "y" --dry-run
```

## Real run (spawns claude CLI — costs tokens)

```bash
export AIRTABLE_TOKEN=...
export TELEGRAM_BOT_TOKEN=...
export TELEGRAM_CHAT_ID=...
node agents/escriba/escriba.mjs --tenant pinnacle --mode plan_week
```

Requires:
1. `claude` CLI authenticated
2. 3 env vars above
3. `airtable.content_queue_table_id` set in tenant JSON (create `Content_Queue` table first with schema from SKILL.md)
4. Clean environment (not nested inside another Claude Code session)

## Cron (cuando Jorge apruebe)

```cron
# Lunes 10 AM CST — plan semanal (tras El Posicionador deep_audit de 9 AM)
0 16 * * 1 cd /path/to/alex-real-estate-system && node agents/escriba/escriba.mjs --tenant pinnacle --mode plan_week

# Martes-Jueves 11 AM CST — draft de los artículos del plan (uno por día)
0 17 * * 2,3,4 cd /path/to/alex-real-estate-system && node agents/escriba/escriba.mjs --tenant pinnacle --mode draft_article

# 1ero de cada mes 3 AM UTC — minar ATP
0 3 1 * * cd /path/to/alex-real-estate-system && node agents/escriba/escriba.mjs --tenant pinnacle --mode atp_mine
```

## Token cost estimate

- `atp_mine`: 3-5K tokens (~$0.03-0.05 con Sonnet)
- `plan_week`: 5-8K tokens (~$0.05-0.08)
- `draft_article` (bilingüe EN+ES, 1200 words each): 15-25K tokens (~$0.15-0.25)
- **Weekly total** (1 plan + 3 drafts bilingües): ~60-85K tokens/week, ~$0.60-0.85

Per R8 SaaS billing: por tenant por mes ≈ 240-340K tokens = $2.40-3.40 input + output. Cross-subsidiable con tier plan.

## Workflow end-to-end esperado

1. Lunes 9 AM CST → El Posicionador corre `seo_deep` → issues + gaps en Airtable SEO_Audits
2. Lunes 10 AM CST → **El Escriba `plan_week`** lee esos gaps → 3 artículos planificados en Content_Queue status=Planned
3. Mar-Jue 11 AM CST → **El Escriba `draft_article`** una vez por día → 3 drafts listos en status=Review
4. Humano (Jorge) revisa en Airtable, ajusta, cambia status a Approved
5. Próxima capa (futura): un agente "El Publicador" lee Approved → publica a WordPress vía `pinnacle_wp_bridge.php` → status=Published

## R9 compliance

- ✅ Sub-sub-agente con rol dedicado (content writing)
- ✅ Tenant-aware (R8)
- ✅ Mobile-first en el output (paragrafos 2-4 líneas, scannable)
- ✅ Always-on (cron)
- ✅ Billing-ready (tokens_used por run)
- ⚠ Deployment pending

## Pending before production

1. **Jorge approval:** crear tabla `Content_Queue` en Airtable base (schema en SKILL.md) → pegar `content_queue_table_id` en `pinnacle.json`
2. **Host del cron** (compartido con El Mercader + El Posicionador)
3. **Auth `claude` CLI** en el host
4. **Decidir flow de publicación:** auto-draft a WP via bridge (ya soporta `create_post`) o review-first en Airtable
5. **Smoke test:** `atp_mine --dry-run` → real `atp_mine` → real `plan_week` → real `draft_article` en un tópico específico

## Author log

- 2026-04-23: v1 draft por ALEX. Tercero del plantel R9 shipped (Mercader → Posicionador → Escriba). Jerarquía Posicionador→Escriba documentada. Shared runtime code entre Mercader/Posicionador/Escriba ahora 80%+ — refactor a `agents/_shared/runner.mjs` planificado para cuando Cazador se sume y tengamos 4 instancias.
