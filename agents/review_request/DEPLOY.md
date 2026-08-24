# Deploy — review_request

Lo que sigue corre en el VPS ALEX (`root@187.77.215.146`). Desde la máquina de Jorge no hay
llave SSH autorizada, así que estos pasos quedan pendientes de ejecutar allá.

## 1. Verificar credenciales

```bash
grep -E '^(QUO_API_KEY|QUO_FROM_NUMBER|GOOGLE_REVIEW_URL)=' /opt/alex-bot/.env
```

`QUO_API_KEY` ya debería estar — es la que usa El Supervisor para sondear la API. Lo que
seguro falta es el número emisor y el link:

```bash
echo 'QUO_FROM_NUMBER=+1XXXXXXXXXX' >> /opt/alex-bot/.env
echo 'GOOGLE_REVIEW_URL=https://g.page/r/CW11zSNR9BL0EBM/review' >> /opt/alex-bot/.env
```

**Jorge tiene que confirmar el número.** El teléfono del negocio en el tenant config es
(920) 367-1272, pero no está verificado que ese sea el inbox de Quo. Sale de
`GET https://api.openphone.com/v1/phone-numbers` con la key en `Authorization`.

**No hay dependencias npm.** El agente pega directo contra la API de Quo con `fetch`.

## 2. Traer el código

Primero confirmar qué remote sigue `/opt/alex-bot`. `vps_deploy.sh` en la raíz del repo dice
`alex-real-estate-system`, pero eso es texto viejo de antes del merge (commit `03ce5d9`,
"import SaaS code from alex-real-estate-system"): hoy `agents/` vive en `investoros-web`.

```bash
cd /opt/alex-bot && git remote -v && git branch --show-current
```

Si apunta a `investoros-web`, `git pull` y listo. Si todavía apunta a
`alex-real-estate-system`, este agente no llega por pull — hay que re-apuntar el remote o
copiar la carpeta a mano, y de paso arreglar `vps_deploy.sh` que quedó desactualizado.

```bash
cd /opt/alex-bot && git pull origin main
mkdir -p /opt/alex-bot/logs
```

## 3. Parche del router

`/opt/geo-webhook/router.mjs` — agregar el caso al switch que despacha por `agent`.
El cuerpo del webhook ahora puede traer `lead_id`; la firma HMAC se calcula sobre el body
crudo, así que no cambia nada del esquema de firma.

```js
case 'review_request': {
  const { lead_id } = body;
  // Validar acá también, no solo en el dashboard: esto termina en argv.
  if (!/^rec[A-Za-z0-9]{14}$/.test(lead_id ?? '')) {
    return res.status(400).json({ error: 'lead_id inválido o ausente' });
  }
  spawnAgent('review_request/review_request.mjs', [lead_id]);
  return res.json({ ok: true, queued: true });
}
```

Si `spawnAgent` arma un string de shell en vez de pasar un array de argv, cambiarlo a
`spawn(node, [script, ...args])` antes de conectar esto. El regex de arriba ya bloquea
metacaracteres, pero no conviene depender de una sola capa.

Reiniciar:

```bash
systemctl restart geo-webhook && systemctl status geo-webhook --no-pager
```

## 4. Prueba en seco

```bash
cd /opt/alex-bot && set -a && . ./.env && set +a
DRY_RUN=true node agents/review_request/review_request.mjs rec6NOxpJuKTiCfBF
```

Sale el SMS que se iba a mandar, no toca Quo y no escribe en Airtable.
**Mostrarle el output a Jorge y esperar su OK antes de correr sin `DRY_RUN`.**

Los otros dos candidatos elegibles: `recNkc9RWxslm0Ywl` (Robin), `recukaLRzAUBDfJKW`
(Andrea Vandermeulen).

## 5. Vercel

El dashboard ya manda `lead_id`. Redeploy de `investoros-web` para que salga el botón
"Request Review" en el panel del lead. No hay env vars nuevas.

## 6. Verificar

```bash
tail -f /opt/alex-bot/logs/review_request.log
```

Una línea por intento: `SEND`, `SMS OK`, `EMAIL OK|SKIP|FAIL`, `DONE`, o `BLOCKED` con el
motivo. Si un envío real sale bien, además llega aviso a Telegram.
