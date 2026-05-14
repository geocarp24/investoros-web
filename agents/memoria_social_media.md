# MEMORIA — SOCIAL MEDIA AGENT (Pinnacle Holdings)

> Leído al inicio de cada invocación. Actualizar después de cada sesión.
> Formato de fecha: YYYY-MM-DD

---

## 🧠 ROL Y MISIÓN

Eres el **Social Media Agent**, especialista en contenido digital de Pinnacle Holdings Group LLC.
Eres invocado por ALEX Orquestador. **Solo aceptas órdenes de ALEX.**

---

## 📊 ESTADO DE SISTEMAS — Actualizado 2026-04-05

| Sistema | Estado | Detalle |
|---------|--------|---------|
| Airtable conexión | ✅ OK | Token válido, escritura confirmada |
| Airtable ~~Ideas de Contenido~~ (DEPRECATED 2026-05-08) | ✅ 13 ideas | 6 → En Produccion, 7 → Nueva (Carrusel/Reel) |
| Airtable ~~Publicaciones~~ (DEPRECATED 2026-05-08) | ✅ Lista | Sin registros aún |
| Airtable ~~Scripts de Video~~ (DEPRECATED 2026-05-08) | ✅ Lista | Sin registros |
| Make.com webhook | ✅ HTTP 200 | Acepta payloads, responde "Accepted" |
| Make.com escenario 4636455 | ✅ ACTIVO | Activado por Jorge el 2026-04-05 |
| Facebook Business | ✅ 6 posts scheduled | Semanas 1-4, todos 12pm CDT |
| Instagram @pinnacle.groupwi | ⏳ Pendiente imagen | Blotato conectado pero IG necesita media |
| Google Business Profile | ⏳ Verificación | Esperando aprobación video |
| LinkedIn Company Page | ❌ Pendiente | Por crear |
| Canva banners | ⚠️ Parcial | Pendiente credenciales Canva + Cloudinary |
| Blotato MCP | ✅ ACTIVO | SSE en ~/.claude/settings.json — 14 tools disponibles |

---

## 🔧 PROBLEMAS ENCONTRADOS Y ESTADO (2026-04-05)

### ✅ Ya arreglados por ALEX:
- Campo ` Hashtags` tenía espacio inicial → renombrado a `Hashtags`
- Campo ` Status` tenía espacio inicial → renombrado a `Status`
- Nombres reales de campos documentados (emoji en Caption EN/ES, etc.)
- Flujo completo Airtable probado y confirmado

### ✅ Fixes manuales completados por Jorge el 2026-04-05:
1. `Formato` (~~Ideas de Contenido~~ (DEPRECATED 2026-05-08)) → `Post | Reel | Carrusel | Story` ✅
2. `Tipo` (~~Ideas de Contenido~~ (DEPRECATED 2026-05-08)) → `Educativo | Promocional | Personal` ✅
3. `Formato` (~~Publicaciones~~ (DEPRECATED 2026-05-08)) → corregido ✅
4. Escenario Make ID 4636455 → ACTIVADO ✅

---

## 📋 INSTRUCCIONES PASO A PASO — Activar Make.com

1. Abrir `us2.make.com` e iniciar sesión con `fcmultiser@gmail.com`
2. Ir a **My Scenarios** → buscar "Pinnacle — Social Media Ideas → Airtable" (ID: 4636455)
3. Abrir el escenario — ver el toggle en la esquina superior izquierda
4. Si el toggle está gris (OFF) → click para poner en azul (ON)
5. Hacer click en **"Run once"** para probar
6. Enviar un webhook de prueba desde Telegram: `"prueba webhook social media"`
7. Verificar que se crea registro en Airtable ~~Ideas de Contenido~~ (DEPRECATED 2026-05-08)

**También verificar el mapeo del módulo Airtable dentro del escenario:**
- Módulo: Airtable (Create a Record)
- Base: Pinnacle Social Media (`[REDACTED_AIRTABLE_BASE_ID]`)
- Mapeo de campos (usar los nombres EXACTOS con emojis):

| Campo Make | Campo Airtable |
|-----------|----------------|
| `titulo` | `Título de Idea` |
| `hook` | `Hook` |
| `caption_en` | `🇺🇸 Caption EN` |
| `caption_es` | `🇲🇽 Caption ES` |
| `hashtags` | `Hashtags` |
| `formato` | `Formato` |
| `plataforma` | `Plataforma` |
| `tipo` | `Tipo` |
| `semana` | `Semana` |

---

## 🧪 CÓMO PROBAR EL FLUJO COMPLETO DESDE TELEGRAM

Cuando el escenario Make esté activo, enviar al bot de Telegram:

> "Genera un post educativo para Facebook sobre foreclosure, semana 2, y guárdalo en Airtable"

El bot invocará `invoke_social_media` con `save_to_airtable=True` y el agente:
1. Generará el contenido completo
2. Hará POST a Airtable directo
3. También enviará al webhook Make.com para automatización

---

## 📋 IDEAS EN AIRTABLE — Estado actual (2026-04-05)

| Record ID | Título | Semana | Formato | Plataforma | Status | Blotato ID |
|-----------|--------|--------|---------|-----------|--------|-----------|
| recdF2uT42ay04k69 | S1 - ¿Quién es Jorge Cruz? | 1 | Post | FB+IG | ✅ En Produccion | `4e924cba` — Lun 6 Abr |
| recMwpr2pmMPZmRmf | S1 - ¿Cuánto vale tu casa? | 1 | Post | FB+IG | ✅ En Produccion | `314e7e95` — Mié 8 Abr |
| recnxz2muTo5woVol | S1 - Foreclosure en Wisconsin | 1 | Post | FB | ✅ En Produccion | `7fd1a454` — Vie 10 Abr |
| recMuIrouAvcSD3O5 | S2 - Testimonio Familia Martínez | 2 | Post | FB | ✅ En Produccion | `a609d373` — Lun 13 Abr |
| recOh9DcfkJI27W9a | S2 - 5 Razones para vender por efectivo | 2 | Carrusel | FB+IG | ⏳ Nueva | necesita imágenes |
| recV03FAw75s3MSOP | S2 - ¿Qué es el equity? | 2 | Carrusel | FB+IG | ⏳ Nueva | necesita imágenes |
| recBoDVfwyQ72h2DS | S3 - ¿Qué pasa con tu herencia? | 3 | Post | FB | ✅ En Produccion | `d2f8d770` — Lun 20 Abr |
| recFfp5dAr7H4c4Yv | S3 - Behind the Scenes | 3 | Reel | FB+IG | ⏳ Nueva | necesita video Jorge |
| recw0dHKcbZH5PQax | S3 - Realtor vs Cash Buyer | 3 | Carrusel | FB+IG | ⏳ Nueva | necesita imágenes |
| rec6ngb2ejWej7GS2 | S4 - Jorge habla: Por qué fundé Pinnacle | 4 | Reel | FB+IG | ⏳ Nueva | necesita video Jorge |
| recMWp8QEnS9zBTaN | S4 - El proceso paso a paso | 4 | Carrusel | FB+IG | ⏳ Nueva | necesita imágenes |
| recropHT1yVOD8W7M | S4 - Mitos sobre cash buyers | 4 | Carrusel | FB+IG | ⏳ Nueva | necesita imágenes |
| recvNs3tIzbDtfl8e | S4 - ¿Qué es un Short Sale? | 4 | Post | FB+IG | ✅ En Produccion | `1a20aa31` — Lun 27 Abr |

**Nota sobre fotos de Jorge:** Bot de Telegram analizó 5 fotos enviadas por Jorge (sesión 2026-04-05). Para usarlas en IG, Jorge debe reenviarlas con URL pública o subirlas a GitHub/Cloudinary.

**Nota sobre recCM80pqccFhVLr2:** Era registro de prueba — puede eliminarse.

---

## 📝 LECCIONES APRENDIDAS

| Fecha | Tipo de post | Plataforma | Resultado | Lección |
|-------|-------------|-----------|-----------|---------|
| 2026-04-05 | Post texto bilingüe | Facebook | ✅ Scheduled OK | FB acepta posts texto-puro sin imagen — muy útil para arranque rápido |
| 2026-04-05 | Post texto | Instagram | ❌ No intentado | IG requiere imagen para posts regulares — no soporta texto-puro |

## 🔑 FLUJO VALIDADO — Blotato MCP → Facebook

```
blotato_create_post(
  accountId="25638",
  platform="facebook",
  pageId="965320503341457",
  text="[Caption EN]\n---\n[Caption ES]\n[hashtags]",
  mediaUrls=[],
  scheduledTime="YYYY-MM-DDTHH:MM:SSZ"
)
→ Retorna postSubmissionId inmediatamente
→ Guardar ID en Airtable campo "ID de Publicación"
```

---

*Integrado al sistema ALEX: 2026-04-05*
*Auditado y corregido: 2026-04-05*
*Posts programados: 2026-04-05*
