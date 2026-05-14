# CANVA TEMPLATES — Pinnacle Holdings Group LLC

> Specs para los 3 templates de Canva usados por el flujo automatizado ALEX → Make.com → Canva API.
> Última actualización: 2026-04-05

---

## 🎨 BRAND KIT PINNACLE

```
Colores:
  Primario:    #0A1628  (azul marino oscuro)
  Secundario:  #C9A84C  (dorado)
  Fondo:       #FFFFFF  (blanco)
  Texto:       #0A1628  (azul marino) o #FFFFFF sobre fondo oscuro

Tipografía:
  Títulos:     Montserrat Bold
  Cuerpo:      Montserrat Regular
  Accent:      Montserrat SemiBold

Logo:
  Siempre en esquina inferior derecha
  Versión blanca sobre fondo oscuro, versión oscura sobre fondo claro

Teléfono fijo: (920) 777-9886
Website fijo:  pinnaclegroupwi.com
```

---

## 📐 TEMPLATE 1 — POST (1080×1080px)

**Nombre en Canva:** `PINNACLE_POST_BASE`

### Estructura de layers (nombres EXACTOS para la API):
```
Layer name          Tipo        Contenido
─────────────────────────────────────────────────────
"hook_text"         Text Box    Hook del post (máx 80 chars)
"mensaje_text"      Text Box    Mensaje principal (máx 200 chars)
"cta_text"          Text Box    Call to action (máx 60 chars)
"phone_text"        Text Box    (920) 777-9886 — FIJO, no editar
"website_text"      Text Box    pinnaclegroupwi.com — FIJO
"logo_image"        Image       Logo Pinnacle — FIJO, esquina inferior derecha
"bg_overlay"        Rectangle   Overlay de color de fondo — FIJO
```

### Layout visual:
```
┌─────────────────────────────────┐
│  [hook_text]                    │ ← Grande, bold, arriba
│                                 │
│  [mensaje_text]                 │ ← Medio, cuerpo de texto
│                                 │
│  ✅ Beneficio 1                 │ ← Parte del mensaje_text
│  ✅ Beneficio 2                 │
│  ✅ Beneficio 3                 │
│                                 │
│  [cta_text]                     │ ← Bold, resaltado
│  [phone_text] | [website_text]  │ ← Pequeño, abajo
│                        [logo]   │
└─────────────────────────────────┘
```

---

## 📐 TEMPLATE 2 — CARRUSEL (1080×1080px, 5 slides)

**Nombre en Canva:** `PINNACLE_CAROUSEL_BASE`

### Slide 1 — Portada (mismo layout que POST):
```
"hook_text"      Text Box    Título principal del carrusel
"subtitulo_text" Text Box    Subtítulo o intro
"logo_image"     Image       Logo Pinnacle
"slide_num_text" Text Box    "1/5" — se actualiza por slide
```

### Slides 2-4 — Contenido:
```
"slide_titulo_text"   Text Box    Título del slide
"slide_cuerpo_text"   Text Box    Contenido del slide
"slide_num_text"      Text Box    "2/5", "3/5", "4/5"
"logo_image"          Image       Logo pequeño, esquina
```

### Slide 5 — CTA Final:
```
"cta_text"       Text Box    Call to action
"phone_text"     Text Box    (920) 777-9886
"website_text"   Text Box    pinnaclegroupwi.com
"logo_image"     Image       Logo Pinnacle, central
```

---

## 📐 TEMPLATE 3 — REEL / STORY (1080×1920px)

**Nombre en Canva:** `PINNACLE_REEL_BASE`

### Estructura de layers:
```
Layer name          Tipo        Contenido
─────────────────────────────────────────────────────
"hook_text"         Text Box    Hook (arriba, grande — máx 60 chars)
"mensaje_text"      Text Box    Mensaje central (máx 150 chars)
"cta_text"          Text Box    CTA (abajo, bold)
"phone_text"        Text Box    (920) 777-9886
"logo_image"        Image       Logo — esquina superior izquierda
"bg_video_thumb"    Image       Thumbnail de fondo (opcional)
```

### Layout visual (vertical 9:16):
```
┌───────────────────┐
│ [logo]            │ ← Arriba izquierda
│                   │
│                   │
│  [hook_text]      │ ← Centro-arriba, grande
│                   │
│  [mensaje_text]   │ ← Centro
│                   │
│                   │
│  [cta_text]       │ ← Centro-abajo, resaltado
│  [phone_text]     │ ← Abajo
└───────────────────┘
```

---

## 🔑 CÓMO OBTENER LOS TEMPLATE IDs

Una vez creados los templates en Canva:

1. Abre el template en Canva
2. Mira la URL: `https://www.canva.com/design/DAF.../edit`
3. El ID es la parte `DAF...` — cópiala
4. Guárdala en `.env`:
   ```
   CANVA_TEMPLATE_POST=DAF...
   CANVA_TEMPLATE_CAROUSEL=DAF...
   CANVA_TEMPLATE_REEL=DAF...
   ```

---

## 📡 CANVA API — Endpoints relevantes

```
Base URL: https://api.canva.com/rest/v1/

POST /designs                    → Crear diseño desde template
  Body: { "asset_type": "image", "design_type": {"preset": "socialMedia"} }

POST /designs/{designId}/autofill  → Rellenar campos del template
  Body: { "brand_template_id": "...", "data": { "hook_text": { "type": "text", "text": "..." } } }

POST /exports                    → Exportar diseño
  Body: { "design_id": "...", "format": "jpg", "export_quality": "pro" }

GET  /exports/{exportId}         → Obtener status + URL del export
  Respuesta cuando listo: { "job": { "status": "success", "urls": ["https://..."] } }
```

### Autenticación OAuth 2.0:
```
1. GET https://www.canva.com/api/oauth/authorize
   ?client_id={CLIENT_ID}
   &response_type=code
   &scope=design:content:write asset:read

2. POST https://api.canva.com/rest/v1/oauth/token
   Body: { "grant_type": "authorization_code", "code": "...", "client_id": "...", "client_secret": "..." }
   → Devuelve access_token (válido 1h) + refresh_token
```

---

## ⚙️ INSTRUCCIONES PARA JORGE — Crear los templates

1. Ir a `canva.com` → New Design → Custom size
2. **Post:** 1080 × 1080 px → diseñar con brand kit Pinnacle
3. Nombrar cada text box EXACTAMENTE como indica esta guía (click derecho → Rename layer)
4. **Carrusel:** duplicar el post, añadir 4 slides más con sus layers nombrados
5. **Reel:** New Design → 1080 × 1920 px → mismo proceso
6. Guardar los 3 Template IDs de las URLs y pasarlos a ALEX

*Tiempo estimado: 30-45 minutos*

---

*Creado: 2026-04-05*
*Parte del sistema ALEX — Flujo Canva + Cloudinary + Airtable*
