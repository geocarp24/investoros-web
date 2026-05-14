# El Cartógrafo — GBP Write-Side Sub-Agent

Complementa a El Posicionador (`maps_deep` read-only audit) con la capa de EJECUCIÓN sobre Google Business Profile. Diseñado con paranoia anti-ban.

**Nunca genera reviews. Nunca cambia name/address/phone automáticamente. Nunca publica sin approval humano por Telegram.**

## Files

| Path | Purpose |
|---|---|
| `SKILL.md` | Anthropic skill spec + hard-coded rules + rate limits table + Airtable schemas |
| `mcp_server/server.py` | FastMCP server exposing GBP tools with guardrails (circuit breaker + rate limits + audit log) |
| `mcp_server/pyproject.toml` | Python deps (`fastmcp`, `google-auth`, `google-api-python-client`) |
| `cartografo.mjs` | Node orchestrator — procesa GMB_Queue Airtable → Telegram approval → MCP call *(v1 scaffold)* |
| `secrets/.gitignore` | Never commit OAuth JSON |

## Status 2026-04-23

- ✅ OAuth flow completo (Jorge 2026-04-23 desde PC)
- ✅ Access token + refresh token guardados en `secrets/pinnacle_gbp_oauth.json`
- ✅ MCP server tools wire-up end-to-end: `gbp_list_accounts`, `gbp_list_locations`, `gbp_get_location`, `gbp_list_reviews`, `gbp_list_insights`, `gbp_publish_post`, `gbp_respond_review`, `gbp_answer_qa`
- 🚨 **BLOQUEANTE PRIMARIO: GBP listing NOT PUBLICLY VISIBLE** — el listing "Pinnacle Holdings Group — We Buy Houses Cash Wisconsin" existe pero no está verificado. Hasta que Jorge complete video verification (3-5 días Google review):
  - Todas las lecturas API retornan vacío/4xx
  - Los writes (posts, reviews, Q&A) son bloqueados por Google
  - La quota increase NO aplica mientras el listing sea invisible
- ⚠️ Quota bloqueando operaciones reales (secundario, post-verificación): proyecto `pinnacle-alex-bot` en Testing con default `1 req/min`

### Solución quota (Jorge en Google Cloud Console)

**Opción A (recomendada):** Solicitar aumento de quota gratis
1. https://console.cloud.google.com/apis/api/mybusinessbusinessinformation.googleapis.com/quotas?project=pinnacle-alex-bot
2. Selecciona "Requests per minute" → click lápiz (Edit)
3. Pedir `300` requests/min (estándar Google, se aprueba automático en minutos)
4. Repite para `mybusinessaccountmanagement.googleapis.com` y `mybusiness.googleapis.com`

**Opción B:** Publicar app a Production (más complejo, requiere OAuth verification si usas scopes sensibles — `business.manage` NO es sensible, podría aprobarse en auto)

### Upload photo — único stub pendiente

`gbp_upload_photo()` todavía stub porque requiere POST multipart de bytes (no simple JSON). Implementar cuando se necesite en próxima iteración.

## El plan de 5 pasos para deploy

### Paso 1 — Google Cloud setup (15 min, JORGE hace esto)

1. Ir a [console.cloud.google.com](https://console.cloud.google.com) con el email admin del GBP de Pinnacle
2. Crear proyecto: `pinnacle-gmb`
3. Enable APIs:
   - Business Profile API
   - My Business Business Information API
   - My Business Account Management API  
   - My Business Q&A API
   - My Business Posts API
4. Crear OAuth 2.0 Client ID (tipo: "Desktop app")
5. Download JSON credentials → salvar como `agents/cartografo/secrets/pinnacle_gbp_oauth.json`
6. Pedir acceso a Google Business Profile API quota (si el proyecto lo requiere): https://developers.google.com/my-business/content/prereqs

### Paso 2 — Instalar MCP server deps (1 comando)

```bash
cd agents/cartografo/mcp_server
uv sync
```

### Paso 3 — Registrar MCP en Claude Code

Editar `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "gbp": {
      "command": "uv",
      "args": [
        "--directory",
        "/home/user/alex-real-estate-system/agents/cartografo/mcp_server",
        "run",
        "python",
        "server.py"
      ],
      "env": {
        "GBP_TENANT_ID": "pinnacle",
        "GBP_OAUTH_JSON": "/home/user/alex-real-estate-system/agents/cartografo/secrets/pinnacle_gbp_oauth.json",
        "AIRTABLE_TOKEN": "${AIRTABLE_TOKEN}",
        "AIRTABLE_BASE_ID": "[REDACTED_AIRTABLE_BASE_ID]",
        "AUDIT_LOG_TABLE": "tblXXXXXX",
        "CIRCUIT_STATE_FILE": "/tmp/gbp_circuit_pinnacle.json"
      }
    }
  }
}
```

Luego reiniciar Claude Code. Debería aparecer ícono MCP conectado.

### Paso 4 — Crear Airtable tablas

En base `[REDACTED_AIRTABLE_BASE_ID]`:

- `GMB_Queue` — schema en SKILL.md (queue_id, tenant_id, operation, payload_json, status, approval_requested_at, approved_at, executed_at, api_response, tokens_used, created_at)
- `GMB_Audit_Log` — schema en SKILL.md (log_id, tenant_id, queue_id, operation, before_state, after_state, api_status_code, approved_by, created_at)

Pegar `table_id` de `GMB_Audit_Log` en el env var `AUDIT_LOG_TABLE` del MCP config (paso 3).

### Paso 5 — Smoke test (read-only primero)

```bash
# Dentro de Claude Code, después del restart:
# Pedir: "Usa el MCP gbp y corre gbp_health_check"
# Esperamos: {ok:true, oauth_file_present:true, env_complete:true, circuit_state:{state:"closed"}}
```

Luego probamos `gbp_list_locations` (read-only). Si devuelve las locations de Pinnacle → OAuth está OK.

Solo DESPUÉS probamos un `publish_post` de prueba (con approved_by="smoke-test") que terminará en audit log pero NO publicará (porque el TODO real en `server.py` devuelve STUB).

Cuando querás activar real publishing: quitar el TODO y habilitar el HTTP call real en cada tool.

## Rate limits hard-coded

| Tool | Per hour | Per day | Per month |
|---|---|---|---|
| `gbp_publish_post` | 1 | 2 | — |
| `gbp_respond_review` | 2 | 5 | — |
| `gbp_upload_photo` | 1 | 2 | — |
| `gbp_update_hours` | 1 | 1 | 1 |
| `gbp_update_description` | 1 | 1 | 1 |
| `gbp_answer_qa` | 1 | 2 | — |
| **TOTAL daily cap** | | **10** | |

Exceder = request denied antes de llegar a Google. Si Google devuelve 429/403 = circuit breaker se abre 24h automático.

## Operaciones hard-prohibited (siempre devuelven error)

- `gbp_update_name` — triggers Google review
- `gbp_update_address` — triggers re-verification
- `gbp_update_phone` — triggers spam detection  
- "Generar reviews" — no existe como tool; ningún code path lo puede llamar

Estas 3 operaciones sí existen como tools registered, PERO siempre devuelven `OPERATION_PROHIBITED` y registran el intento en audit log. Así si algún día algo/alguien trata de llamarlas, queda trazado.

## Aprovalflow humano

1. ALEX / El Posicionador / Jorge agregan entry a `GMB_Queue` status=Draft
2. Cartógrafo cron (cada hora) levanta Drafts → cambia a PendingApproval + manda Telegram:
   ```
   🗺️ El Cartógrafo — approval required
   Tenant: Pinnacle
   Operation: publish_post
   Draft: "..."
   Reply YES to approve | NO to reject | edited text to replace
   ```
3. Jorge responde → entry → status=Approved
4. Próximo cron tick levanta Approved + valida rate limit + circuit breaker + ejecuta MCP call
5. Response + audit log + Telegram confirmation

## Estado actual (2026-04-23)

**v1 SCAFFOLD COMPLETE.** Todos los guardrails + rate limiter + circuit breaker + audit log implementados. Las 10 tools expuestas pero cada `publish_post / respond_review / upload_photo / update_hours / update_description / answer_qa / list_locations / get_location / list_reviews / list_insights` devuelve `STUB_NOT_IMPLEMENTED` porque el API call real requiere OAuth de Jorge (Step 1).

Cuando Jorge complete Step 1, yo cableo el HTTP call real de cada tool (~30 min de código — google-api-python-client ya en deps).

## Pending de Jorge

1. Completar Paso 1 (Google Cloud setup) + pegar OAuth JSON en `secrets/`
2. Crear tablas `GMB_Queue` + `GMB_Audit_Log` + pegar `table_id` en MCP env config
3. Pasar location_id de Pinnacle GBP (formato `accounts/NNNNN/locations/MMMMM`)
4. Confirmar approval channel Telegram (mismo chat_id del resto)
