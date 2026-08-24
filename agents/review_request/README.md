# review_request — pedido de reseña de Google

Manda un SMS (y email si hay) pidiendo reseña de Google al cliente de un job terminado.

**No tiene cron y no debe tenerlo.** Se dispara a mano desde el CRM: Jorge abre el lead,
aprieta "Request Review", y el webhook router lanza este proceso con el record id.

Manda por **Quo**, no por Twilio. No usa el CLI de Claude ni dependencias npm: Node puro
con `fetch`.

## Uso

```bash
node agents/review_request/review_request.mjs rec6NOxpJuKTiCfBF --dry-run
node agents/review_request/review_request.mjs rec6NOxpJuKTiCfBF
```

Flags: `--tenant <slug>` (default `geo-carpentry`), `--dry-run`, `--lead-id <rec...>`.
`DRY_RUN=true` en el entorno hace lo mismo que `--dry-run`.

## Env

| Variable | Obligatoria | Para qué |
|---|---|---|
| `AIRTABLE_TOKEN_GEO` | sí | leer/escribir Geo_Leads (el nombre sale de `tenant.airtable.token_env`) |
| `GOOGLE_REVIEW_URL` | sí | link que va en el mensaje |
| `QUO_API_KEY` | sí (envío real) | el mismo que ya usa El Supervisor |
| `QUO_FROM_NUMBER` | no | override del emisor; por default sale de `tenant.quo.from_number` (+1 920 367 1272) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | no | aviso a Jorge cuando sale un envío |
| `REVIEW_REQUEST_LOG` | no | default `/opt/alex-bot/logs/review_request.log` |

## Reglas que corta el envío

Cualquiera de estas aborta antes de tocar Quo, sale con código 3 y deja línea `BLOCKED` en el log:

- `Do Not Contact` marcado, o `Lead Status = DNC`
- `Review Requested At` a menos de 30 días
- el lead no tiene ningún job vinculado
- el teléfono no normaliza a E.164 de 10/11 dígitos

## Salida

Última línea de stdout es JSON, para que el router la devuelva al CRM:

```json
{"ok":true,"dry_run":false,"lead_id":"rec...","to":"+19204285771","language":"English","sms_id":"AC...","review_requested_at":"2026-08-23"}
```

Códigos de salida: `0` enviado · `2` uso incorrecto · `3` bloqueado por validación · `1` fatal.

## Airtable

Base `appAQpveuAec077jF`, tabla Geo_Leads `tblaH41HWeVG9ZXLn`.
El agente lee y escribe **por field ID** (`returnFieldsByFieldId=true`), así que renombrar
columnas en Airtable no lo rompe. El cooldown vive en `Review Requested At`
(`fldriwvb3O16lSpCk`, tipo Date, creado 2026-08-23).

Geo_Leads no guarda email. El email es best-effort: se cruza el teléfono contra la tabla
Contacts y, si aparece uno, se manda por el mismo `send_notification.php` de Hostinger que
usa El Remitente. Si no aparece, se manda solo el SMS y queda `EMAIL SKIP` en el log.

## Quo

El SMS sale por `POST https://api.openphone.com/v1/messages`, con la API key cruda en
`Authorization` (sin `Bearer`). Es el mismo host y el mismo header que sondea El Supervisor
en `supervisor.mjs`: Quo es el rebrand de OpenPhone y la API siguió donde estaba. No hay un
`api.quo.com` — si alguien lo "arregla", lo rompe.
