# PROTOCOLO DE EJECUCIÓN — ALEX SYSTEM

> **Aprobado por Jorge Cruz — 2026-04-22. NO NEGOCIABLE.**
> Este protocolo es la forma **obligatoria** de ejecutar toda tarea no trivial en los sistemas de Pinnacle, Geo Carpentry, Fer, Tracy, Social Media, y cualquier operación que toque producción, Airtable, WordPress, VPS, Hostinger, o integraciones externas.
> Se lee al inicio de cada sesión junto con `memoria_ALex.md` y `protocolo_seguro.md`.

---

## 🎯 PRINCIPIO CERO — "NO ROMPER NADA"

Toda operación pasa por este filtro antes de ejecutarse:
1. ¿Qué puede romperse? (blast radius)
2. ¿Cómo reviertir si algo sale mal? (rollback path)
3. ¿Quién lo verá mientras se arregla? (público / interno / nadie)

Si no tienes respuestas claras a las tres — **para y responde al Jefe primero.**

---

## 📋 FASES DEL PROTOCOLO (seguir en orden, sin saltarse ninguna)

### FASE 1 — CARGA DE CONTEXTO (siempre, incluso para tareas pequeñas)
1. Leer `memoria_ALex.md` completo. Extraer reglas críticas activas.
2. Leer `agents/shared_conversation.json` (últimos 10 mensajes) para retomar hilo.
3. Leer `agents/PROTOCOLO_EJECUCION.md` (este archivo).
4. Leer `agents/protocolo_seguro.md` (credenciales + seguridad).
5. Verificar `.env.sandbox` existe y credenciales del bridge funcionan (ping).
6. **Si falta alguna credencial:** pedirla UNA SOLA VEZ al Jefe y guardarla persistente.

### FASE 2 — DIAGNÓSTICO ANTES DE ACCIÓN
Nunca modifiques algo sin antes leerlo. Para cualquier cambio en WP / Airtable / archivo:
1. **Leer el estado actual** (`get_post`, `SELECT`, `cat`, etc.) y guardarlo en variable / archivo
2. **Documentar el estado esperado** después del cambio
3. **Identificar dependencias** que podrían verse afectadas
4. Si hay ambigüedad → preguntar al Jefe una sola vez, no suponer

### FASE 3 — BACKUP OBLIGATORIO ANTES DE CAMBIOS DESTRUCTIVOS
Definición de "destructivo": cualquier cosa que sobrescriba, borre, modifique contenido existente (no aplicable a archivos nuevos).
1. Snapshot completo del recurso afectado → carpeta `backups/{sistema}/{YYYY-MM-DD_HHMMSS}/`
2. Commit + push del backup a GitHub **antes** de ejecutar el cambio
3. README.md en la carpeta con comando exacto de restauración
4. En destructivos de alto impacto (DB, masivos en Airtable, deploy a master): pedir confirmación explícita al Jefe

### FASE 4 — DIVISIÓN DE TAREAS GRANDES (regla "por partes")
**Regla dura:** ningún mensaje al usuario debe generar >400 líneas de código en un solo streaming. Supera eso = riesgo de `stream idle timeout`.
1. Dividir en módulos pequeños (< 300 líneas cada uno)
2. Usar la herramienta **Write** (escribe al disco, NO pasa por stream del chat)
3. Una parte = un archivo = un mensaje con notificación corta
4. Reportar avance al Jefe después de cada parte: "✅ Parte N/M lista. Sigo."
5. Si se necesita un "bundle" final, generarlo con script (`build.py`) no pegándolo inline

### FASE 5 — DEPLOY SEGURO
Orden obligatorio para cada cambio que afecte producción:
1. **Test local primero** — archivo aislado, headless browser, unit test, lo que aplique
2. **Deploy como DRAFT / staging / branch no-master** — invisible al público
3. **Verificar post-deploy** con request real (HTTP 200, contenido esperado, ping)
4. **Preview al Jefe** — mandar URL exacta, decirle qué probar
5. **Solo cuando el Jefe apruebe** → publicar / merge a master / promote a prod
6. **Purgar cache** (LiteSpeed + WP + Cloudflare si aplica) al final
7. **Verificar una última vez** desde afuera (curl sin cookies) que el cambio es visible

### FASE 6 — VERIFICACIÓN POST-DEPLOY
Nunca marcar una tarea como "hecha" sin evidencia:
1. HTTP status 200 confirmado
2. Contenido esperado presente (grep / DOM check)
3. Funcionalidad probada end-to-end (el flujo real que el usuario va a usar)
4. Sin errores en logs (si se pueden leer)
5. **Si falla la verificación** → rollback inmediato con el backup de Fase 3, reportar al Jefe

### FASE 7 — AUTO-BACKUP Y MEMORIA
1. Todo cambio a código / memoria pasa por el hook `PostToolUse` que commit+pushea
2. Cada 15 min de actividad real → checkpoint manual en `memoria_ALex.md`:
   - Estado actual del trabajo
   - Próximo paso
   - Bloqueadores
   - URLs / IDs / credenciales nuevas descubiertas (NO valores reales)
3. Al final de cada sesión → resumen en `memoria_ALex.md` con commits y próximos pasos

---

## 🛑 ERRORES QUE YA COSTARON CRÉDITOS — NO REPETIR

| Error | Qué pasó | Regla para evitarlo |
|---|---|---|
| Stream idle timeout | Intenté escribir 600+ líneas en un mensaje | **Fase 4:** dividir por partes, usar Write al disco |
| 403 WAF al crear page | Inyecté `<script>` inline en payload al bridge | **No inline scripts en post_content.** Usar `<script src="/agents/.../x.js">` con archivos estáticos deployados por SCP |
| Orden de DOMContentLoaded | core.js y screens.js compitieron por DCL | **Un solo punto de entrada.** Exponer funciones y encadenar |
| "Home rota" (pérdida de contenido) | El home ya tenía content vacío desde antes | **Fase 2:** siempre leer antes de asumir culpa. Fase 3: snapshot antes de cualquier sospecha de cambio |
| Credenciales perdidas entre sesiones | Sandbox web no persiste `.env` | **Fase 1:** `.env.sandbox` gitignored + referencia en memoria |
| Deploy sin trigger | Branch no-master no dispara Actions | **Fase 5:** cherry-pick a master solo con los archivos del deploy, no empujar todo el branch |

---

## ✅ CHECKLIST PARA TODA TAREA ANTES DE EJECUTAR

Copia mental obligatoria antes de la primera tool call:

```
[ ] Contexto cargado (memoria, shared_conversation, protocolo)
[ ] Diagnóstico completo: leí el estado actual
[ ] Backup hecho (si destructivo)
[ ] Tarea dividida en partes < 300 líneas cada una
[ ] Método de deploy seguro definido (draft → preview → publish)
[ ] Plan de rollback escrito (1 comando, conocido)
[ ] Sé cómo voy a verificar que funcionó
[ ] El Jefe sabe lo que voy a hacer (o ya lo aprobó en memoria)
```

Si falta alguno → no arranques. Primero cúbrelo.

---

## 📌 EXCEPCIONES PERMITIDAS (cuando se puede saltar partes)

Solo estos casos permiten acortar el flujo:
1. **Consulta 100% de lectura** (`list_pages`, `get_post`, `SELECT`, curl GET) — saltar Fase 3 (backup) porque no cambia nada.
2. **Archivo nuevo que no pisa existente** — saltar Fase 3 (no hay qué respaldar).
3. **Operación trivial (< 10 líneas, 1 archivo, reversible con git revert)** — saltar Fase 4 (división por partes) pero NO Fase 5 (deploy seguro).

**Ningún otro caso permite saltar fases.** Si tienes duda → aplicar el protocolo completo.

---

## 🔁 INVOCACIÓN DEL PROTOCOLO

Al inicio de cada sesión, confirmar en el primer mensaje al Jefe:

> "Protocolo cargado. Listo para operar según Fases 1–7."

Si el Jefe da una orden directa que parece violar el protocolo, responder:
> "Eso violaría Fase N del protocolo (razón). Propuesta alternativa: ..."

**El protocolo protege al Jefe del daño operativo, no es burocracia para frenar.**
