# MEMORIA DE CONVERSACIONES — ALEX Telegram Bot

Este archivo contiene resúmenes automáticos de las sesiones de Telegram.
Se actualiza con /guardar o /reset. ALEX lo lee al inicio de cada sesión.

---

## 2026-04-22 — Sesión Claude Code (resumen para continuidad)

Jorge cerró la fase pública del sitio Pinnacle. Quedaron en producción:
- Webform `/get-my-offer/` multi-step (EN/ES, dedup por phone con fallback a address, flujo returning-user, session resume 2h via localStorage, Fer brain micro-acks empáticos)
- Chatbot Fer-style flotante en todas las páginas excepto el form (con escalación automática a Telegram cuando detecta lead caliente)
- Contact page rediseñada: 5 métodos (Phone, Email, Visit, Online Form, Chat)
- CTAs del sitio ("Get My Free Offer") apuntando todos a `/get-my-offer/`
- Bug de email reply corregido en `secretario/email_monitor.py` (resolución 3-tier: Reply-To > From > body scan)

Backend: `hostinger/agents/pinnacle_public.php` (~600 líneas) expone `lookup_existing`, `form_brain`, `chat_message` (acciones nuevas).

Documentación completa: `docs/{ARCHITECTURE,AGENT_REGISTRY,TASK_MATRIX,COST_OPTIMIZATION,SCALABILITY,COMMERCIALIZATION}.md` + 3 sub-docs de comercialización (pricing, packaging, GTM).

Protocolo de ejecución de 7 fases en `agents/PROTOCOLO_EJECUCION.md` (cargar al inicio de cada sesión).

Si Jorge retoma desde Telegram, el contexto está en `memoria_ALex.md` raíz, sección "2026-04-22 — SESIÓN COMPLETA".

---

## 2026-04-22 — MODO /GOD (permanente)

Orden directa de Jorge — NO NEGOCIABLE — aplica a TODOS los modelos (Opus/Sonnet/Haiku) y TODOS los entornos (Telegram, Claude Code, Claude.ai, sub-agentes).

ALEX opera siempre en modo `/GOD`: skills-first sin excusas + cost-benefit (tokens+tiempo) + surgical edits + diagnose-before-code + luz verde permanente en stack Pinnacle.

Antes de cualquier acción no trivial: evaluar qué skill aplica e invocarlo vía tool `Skill`. Default en duda: invocar.

Skills de activación automática:
- Bug → `systematic-debugging`
- Antes de "listo" → `verification-before-completion`
- Código nuevo → `test-driven-development`
- Post-cambio → `simplify`
- Multi-paso → `writing-plans`/`executing-plans`
- Creative → `brainstorming`
- 2+ tareas paralelas → `dispatching-parallel-agents`

Detalle completo en `CLAUDE.md` sección "MODO /GOD — OPERACIÓN PERMANENTE".

**Confirmación obligatoria al inicio de sesión (Telegram incluido):** *"Modo /GOD activo, skills-first habilitado, memoria always-on, luz verde permanente en stack Pinnacle."*

### Skill de memoria SIEMPRE ACTIVO (toda la vida, sin excusas)
El bot de Telegram debe leer al arrancar: `memoria_ALex.md`, `agents/memoria_alex.md`, `agents/shared_conversation.json` (últimos 60), `telegram_memory.md`, `agents/PROTOCOLO_EJECUCION.md`. Escribir inmediato cuando Jorge apruebe regla/lección. Escribir al cierre resumen datado en las 3 memorias conjuntas. Skill designado: `self-improving-agent`.

### MOBILE-FIRST — PRIORIDAD #1 PERMANENTE (2026-04-23)
Todo el trabajo de Pinnacle se optimiza mobile-first como prioridad #1. Mayor tráfico web hoy = mobile. Aplica a popups, formularios, páginas, chatbot, emails, social creatives, CTAs, imágenes, cualquier componente nuevo. NUNCA excluir mobile por viewport sin consultar al Jefe. Test mobile PRIMERO, desktop después. Detalle completo en `memoria_ALex.md` regla R7 y `CLAUDE.md` sección 1b.

### SAAS-READY / MULTI-TENANT-FIRST (2026-04-23)
Todo se construye como producto vendible a terceros. Pinnacle = tenant cero. Reglas: nada hardcodeado (todo por-tenant config), tenant isolation, separación core/config/deployment, onboarding documentado, billing hooks upfront, validar licencias deps (AGPL no-go para mono core, MIT/Apache safe), security defaults día 1, naming genérico. Detalle completo en `memoria_ALex.md` regla R8 y `CLAUDE.md` sección 1c.

---

## 2026-04-28 — Sesión Claude Code — Fix spam Supervisor

Jorge reportó "el auditor me está enviando mensajes a cada rato y en fila". Causa: El **Supervisor deep mode** (cada 1h) alertaba a Telegram cada vez que había warnings, y el warning "seg_sms_sent stale 40h" (falso positivo crónico) generaba 24 mensajes idénticos/día.

**Fix aplicado:** dedup 24h en `agents/supervisor/supervisor.mjs` — compara warning-set contra runs deep en ventana 24h, suprime si idéntico, notifica si cambió.

**Falso positivo del warning:** verificado en Airtable que `Last contact date=2026-04-28` y `SMS Sent=true` → el reloj suizo Hostinger SÍ corre. El warning aparece porque no hay contactos due en Seguimiento (5 en stage, ninguno necesita toque hoy). El log no registra `seg_sms_sent` cuando no hay nada que enviar — el threshold dispara warning falso. Mejora futura: hacer threshold dinámico según pipeline real.

**Memoria desync detectado:** `shared_conversation.json` congelado en 2026-04-06. Bot Telegram en VPS escribe el archivo localmente pero nunca pushea a git. Por eso al abrir Claude Code, el JSON está stale. Memoria canonical sigue siendo `memoria_ALex.md` raíz (actualizada hasta hoy). Pendiente decisión arquitectónica: bot auto-push vs cron VPS→repo sync vs deprecar el JSON.

Resto del estado al cierre 2026-04-23 sigue válido — ver `memoria_ALex.md` sección "2026-04-23 NIGHT" para plantel R9 (10 agentes) y crons activos (17 GHA + 4 Hostinger = 21 jobs).

---

## 2026-04-28 PM — FASE 1 SUPERVISOR AUTÓNOMO

Jorge aprobó visión de convertir El Supervisor en agente auto-curativo, auto-mejorable y autosuficiente. Roadmap 5 fases (1=memoria · 2=confidence + LLM diagnosis · 3=auto-fix expandido + rollback · 4=self-modification propose-only · 5=auto-merge whitelist).

**Fase 1 implementada hoy (no-destructiva):**
- Tabla `Lessons_Learned` en Airtable (`[REDACTED_AIRTABLE_TABLE_ID]`) — síntoma + categoría + outcome + occurrence_count + recommended_action.
- Módulo Learning en `supervisor.mjs`: cada warning/critical observado se registra (CREATE primera vez, INCREMENT recurrencias).
- Recognition: classifier con 5 categorías (infra/pipeline/code/data/unknown).
- Normalizer compartido con dedup de alertas — variantes "stale 40h"/"stale 38h" colapsan al mismo lesson.
- Failure-tolerant: si la tabla no existe, supervisor sigue corriendo.

**Próximas fases requieren aprobación explícita.** El sistema todavía NO toca código solo, NO hace fixes nuevos, NO mergea PRs. Solo aprende.

---

## 2026-04-28/29 — FASE 2 SUPERVISOR AUTÓNOMO

Aprobada y implementada inmediatamente. Construido:

- **LLM Diagnosis** con Sonnet 4.6 (Anthropic API directa) → root_cause + recommended_action + requires_human + action_category por cada lesson recurrente.
- **Confidence Scoring** determinístico — 0 si requires_human o sin fixes; sube por resolved consecutive; HARD FLOOR 0 ante worsened reciente.
- **Decision Layer** — HIGH (>=0.9) auto-apply candidate | MED propone+alerta | LOW escala a humano.
- **Force-alert** para HIGH/MED — rompe dedup porque propuesta nueva = info nueva.
- Costo: ~$0.60/día/tenant.

Phase 2 SIGUE siendo no-destructiva: auto_apply es FLAG para que Fase 3 actúe, no acción inmediata.

**Pendientes:** Fase 3 (auto-fix + rollback + outcome recording), Fase 4 (self-modification propose-only), Fase 5 (auto-merge — siempre decisión humana).

---

## 2026-04-29 — FASE 3 SUPERVISOR AUTÓNOMO

**El loop de auto-curación cierra solo ahora.** Implementada misma sesión que Fases 1+2.

**Whitelist conservadora:**
- `api_retry` — re-probe read-only de openphone/airtable/telegram
- `data_repair` stage_drift — contacts con Stage=New + step>0 → reset a TBC, con rollback

**Verification inmediata:** snapshot before → fix → snapshot after → outcome (resolved/no_effect/worsened).

**Rollback automático** si worsened y action tiene inverse.

**Circuit breaker:** 3+ worsened en últimos 5 deeps → freeze global hasta reset humano.

**Caps:** max 5 fixes/run. Solo deep/incident + HIGH-tier + auto_apply + whitelist + breaker closed.

**Excluidos (propose-only):** cron_restart, cache_purge, config_update, code_fix.

**Loop completo:** Recognition → Recording → Diagnosis (LLM) → Confidence (history-based) → Decision → Action → Verification → Rollback → Outcome → feedback al confidence siguiente.

---

## 2026-04-29 — FASE 4 SUPERVISOR AUTÓNOMO

**Self-modification PROPOSE-ONLY.** El agente puede proponer cambios a su propio código mediante PRs draft, NUNCA mergea solo.

**Disparador:** SOLO modo evolve (cada 3 días con la nueva cadencia).

**Detector:**
- Lessons con `category=unknown` y `occurrence ≥ 3` → propone añadir regex al classifier
- Lessons con `last_outcome=no_effect` y `occurrence ≥ 5` → propone ajustar threshold

**Sonnet 4.6 propone JSON:** `{file, change_type, search, replace, rationale, test_plan}` con `change_type ∈ {threshold_adjust, classifier_regex_add}`.

**Validator (anti-jailbreak):**
- File whitelist estricta: solo `pinnacle.json` (numeric only) y `supervisor.mjs` (solo dentro de classifySymptom)
- Forbidden patterns SIEMPRE bloquean: `requires_human`, `PHASE3_WHITELIST`, `circuit_breaker`, credenciales/API keys
- Diff cap 50 líneas
- Test 6/6: 4 ataques bloqueados, 2 válidos pasaron

**Apply + revert automático** si `node --check` o `JSON.parse` falla.

**Git ops** crean branch `supervisor-autopatch-{run_id_8}`, commit, push, abren PR DRAFT con label `human-review-required`.

**Hard caps:**
- Max 3 PRs auto abiertos total → freeze
- Max 1 propuesta por run
- 1/3 días = ~10 propuestas/mes max

**Telegram alert** con PR link cada vez que se abra uno.

**Pendiente Fase 5 (NUNCA del agente, decisión humana):** auto-merge con sub-whitelist más estrecha + N éxitos consecutivos.

---

## 2026-05-02 — Director v2, Skills Suite, Bot↔GHA bridges

**Bot Telegram (Creativo + Director):** los `_tool_invoke_creativo` y `_tool_invoke_director` ahora SOLO disparan GHA workflow_dispatch. Soportan dos modos: sin record_id → batch (procesa pendientes); con record_id → regenera ese específico. Endpoint: `https://pinnaclegroupwi.com/agents/github_dispatch.php` con `X-Alex-Secret`.

**Director v2 cableado:**
- Cherry-picked de branch huérfana `claude/greeting-setup-yOfqf` (50+ archivos, 14 task commits)
- Faceless reels: Pexels stock + Nano Banana / Flux Schnell + Puppeteer + ffmpeg + música
- Cron `30 21 */3 * *` (cada 3 días)
- 5 tracks de música reales subidos por Jorge (chill, cinematic, tension, upbeat 1+2)
- Hybrid stack (Opción 4): faceless por defecto + HeyGen avatar Jorge cuando llegue API key
- ElevenLabs descartado (silent kinetic basta para faceless)

**Airtable schema:** borrados Branding_Spec + Blotato_Template_ID. Re-creados video_duration + video_cost_cents + Error_Reason (multilineText). Filter director_v2 excluye `Error_Reason!=''` para no reintentar errores.

**15 skills nuevas:** Design Taste Suite (14 — pbakaus/leonxlnx/emilkowalski) + graphify (safishamsi). Reglas obligatorias en `CLAUDE.md` §1e + §1f. Default Pinnacle aesthetic: editorial limpio + warmth para homeowners.

**Pendiente:** Doppler creds verify (test corriendo), Programador (Meta tokens), HeyGen creds.

---

---

## 2026-05-08 — Sesion Claude Code: InvestorOS aprobado + R9 + Sprint 0

Cierre de planeacion mayor. Decisiones aprobadas por Jorge:

1. **R9 nueva regla:** 97% confidencia obligatoria antes de tocar codigo. Skill `pinnacle-memory-preflight` creado en ~/.claude/skills/ auto-invoca pre-flight grep en memoria/docs antes de preguntas.
2. **Producto SaaS nombre:** **InvestorOS** — dominio investoros.tech registrado en Hostinger. Wisconsin LLC extension de Pinnacle Holdings Group.
3. **Track A Social Media:** plan 77-85 posts/sem aprobado con horarios fijos CST. Estrategia 4 fases (Test -> Optimize -> Paid -> Scale). Theme Bank 170 entradas. Director v2 rotacion 5 templates aprobados. Reels 5x3s=15s con division en partes.
4. **Track B InvestorOS app:** plan 90 dias web-first (Next.js + tRPC + Postgres + Tailwind + shadcn). Mobile native = Phase 2 post-launch. Pricing 297/697/1497/3500+. Multi-tenant RLS. Pinnacle = tenant cero.
5. **Bugs publisher** identificados (timing + FB no publica). Sprint A1-A2 fix inmediato.
6. **El Director** (videos largos) = construir desde cero (spec only actualmente).
7. **Meta Pixel** pinnaclegroupwi.com sigue pendiente — deuda en Sprint A11.

Si Jorge retoma desde Telegram, el contexto completo esta en memoria_ALex.md raiz seccion 2026-05-08.

Sprint 0 arrancando: A1 (fix timing) -> A2 (fix FB) -> A3 (Airtable migration) en paralelo con B1 (repo InvestorOS scaffold) + B2 (branding initial).


## 2026-05-08 PM — R12 + maquina Reels/Videos avance
- R12 regla nueva: auto-memoria + auto-commit despues de cada tarea
- A12: SM Manager fuerza 42/28/8 mix por batch_weekly
- A14: pipeline cron cada 4-6h (no cada 3 dias)
- A13 pendiente decision: A atajo Director v2 vs B from scratch
- Smoke test publisher exitoso (FB ID 122109998012844800 programado 17:50 CT)

## 2026-05-08 PM — Track 1 cerrado
Maquina Reels y Videos al 100%. A12 force format mix + A14 pipeline 4-6h + A13 Director v2 Videos ya soporta. PR #11 mergeado. Listo para batch_weekly Domingo.

## 2026-05-08 PM — Vision InvestorOS 8 fases + 6 tenants aprobada
Jorge cerro lluvia de ideas. 8 fases (Identidad/Captacion/Publicidad/CRM/AuditSelf-heal/GrowthFeedback/Attribution/Expansion). 6 tenants Ola 1 (Pinnacle/Geo/FC) → Ola 2 (Nica Transports greenfield) → Ola 3 (ADHD/Essenthia ideas). Total ~10-13 semanas. Arrancando F1.1 Identidad Pinnacle.

## 2026-05-08 — F1.1 IDENTIDAD Pinnacle done
brand_kit.json multi-tenant en agents/tenants/pinnacle/. 16 secciones (messaging, voice, colors, typography, logo, social, compliance, competitors). 7 GAPs pendientes input Jorge. Schema replicable.

## 2026-05-08 — F2 Pinnacle parcial
Rastreador agent base creado: 9 fuentes scraping configuradas (court records WI + Craigslist FSBO + bar attorneys), tabla Airtable lista, 38 tests passing. Falta Firecrawl + writer + runner + cron.

## 2026-05-08 — Geo Carpentry F1 done
brand_kit replicado a Geo. Schema multi-tenant validado. 7 GAPs pendientes Jorge (brand colors + IG + license).

## 2026-05-08 — F2 Pinnacle CERRADA
El Rastreador agent al 100%: 70 tests, scraping config 9 endpoints (WI court records + tax delinquent + Craigslist + Reddit + WI State Bar attorneys), 3 cron entries en master.
