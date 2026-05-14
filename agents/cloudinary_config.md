# CLOUDINARY CONFIG — Pinnacle Holdings Group LLC

> Almacenamiento de imágenes generadas por Canva para Social Media.
> Última actualización: 2026-04-05

---

## 📦 CUENTA

```
Plan:        Free (25GB storage, 25GB bandwidth/mes)
Cloud Name:  [PENDIENTE — ver .env CLOUDINARY_CLOUD_NAME]
Folder:      pinnacle-social-media/
```

### Cómo crear la cuenta:
1. Ir a `cloudinary.com` → Sign Up Free
2. Usar email `deals@pinnaclegroupwi.com`
3. Dashboard → Settings → API Keys → copiar:
   - Cloud Name
   - API Key
   - API Secret
4. Guardar en `.env` (ver abajo)

---

## 🔑 VARIABLES DE ENTORNO

```bash
CLOUDINARY_CLOUD_NAME=pinnacle-holdings     # o el que asigne Cloudinary
CLOUDINARY_API_KEY=xxxxxxxxxxxx
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxx
```

---

## 📡 ENDPOINT DE UPLOAD

```
POST https://api.cloudinary.com/v1_1/{cloud_name}/image/upload

Headers:
  Content-Type: multipart/form-data

Body (form-data):
  file:           [imagen binaria o URL]
  api_key:        {CLOUDINARY_API_KEY}
  timestamp:      {unix_timestamp}
  signature:      {SHA1(public_id=...&timestamp=...&{API_SECRET})}
  public_id:      pinnacle-social-media/pinnacle_s{semana}_{formato}_{fecha}
  folder:         pinnacle-social-media
  quality:        85
  format:         jpg
```

### Ejemplo de respuesta:
```json
{
  "public_id": "pinnacle-social-media/pinnacle_s2_post_20260405",
  "secure_url": "https://res.cloudinary.com/pinnacle-holdings/image/upload/pinnacle-social-media/pinnacle_s2_post_20260405.jpg",
  "width": 1080,
  "height": 1080,
  "format": "jpg",
  "bytes": 245678
}
```

---

## 📁 NAMING CONVENTION

```
Formato: pinnacle_s{semana}_{tipo}_{YYYYMMDD}
Ejemplos:
  pinnacle_s1_post_20260405.jpg
  pinnacle_s2_carousel_20260412.jpg
  pinnacle_s3_reel_20260419.jpg
  pinnacle_s4_story_20260426.jpg
```

---

## 🔄 FLUJO EN MAKE.COM

El módulo de Cloudinary en Make usa el módulo HTTP (no el módulo nativo):

```
Módulo: HTTP → Make a request
URL:    https://api.cloudinary.com/v1_1/{{CLOUD_NAME}}/image/upload
Method: POST
Body:   form-data
  - file:      {{url_imagen_canva}}
  - upload_preset: pinnacle_preset   (crear en Cloudinary Settings → Upload Presets)
```

### Upload Preset (más simple que signature):
1. Cloudinary Dashboard → Settings → Upload → Add upload preset
2. Nombre: `pinnacle_preset`
3. Signing mode: `Unsigned` (para Make.com sin server-side)
4. Folder: `pinnacle-social-media`
5. Format: jpg, Quality: 85

---

## 🌐 URLs PÚBLICAS

Todas las imágenes son públicas y accesibles directamente:
```
https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.jpg
```

Estas URLs se guardan en el campo `URL Visual` de Airtable ~~Ideas de Contenido~~ (DEPRECATED 2026-05-08).

---

## 📊 LÍMITES DEL PLAN FREE

| Recurso | Límite |
|---------|--------|
| Storage | 25 GB |
| Bandwidth | 25 GB/mes |
| Transformations | 25,000/mes |
| Images | Sin límite (hasta 25GB) |

Para el volumen de Pinnacle (3-4 posts/semana) el plan free dura años.

---

*Creado: 2026-04-05*
*Parte del sistema ALEX — Flujo Canva + Cloudinary + Airtable*
