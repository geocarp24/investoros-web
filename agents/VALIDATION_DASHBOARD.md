# 📊 VALIDACIÓN DE OPTIMIZACIÓN DE CRÉDITOS

**Fecha de implementación:** 2026-04-10  
**Status:** ✅ TODAS LAS FASES ACTIVAS

---

## 🟢 FASE 1 — TRACY (Haiku)

| Métrica | Umbral | Status | Notas |
|---------|--------|--------|-------|
| **Success Rate** | ≥95% | ⏳ Por monitorear | Tracy es directo en Airtable |
| **Tokens Usage** | <500 input | ⏳ Por monitorear | Sin razonamiento complejo |
| **Downtime** | 0% | ✅ Normal | No cambios en lógica |

**Validación:** Semanal — verificar que datos se migren correctamente de Tracy → el_chismoso → Contacts

---

## 🟡 FASE 2 — ANÁLISIS DE DEALS (Sonnet)

| Métrica | Umbral | Status | Notas |
|---------|--------|--------|-------|
| **Confidence Score** | ≥7.0/10 | ⏳ VALIDAR | **CRÍTICA** — reducir a Opus si <7.0 |
| **Error Rate** | ≤2% | ⏳ VALIDAR | Fact-Checker debe detectar inconsistencias |
| **Scout Accuracy** | Datos públicos correctos | ⏳ VALIDAR | Spot-check resultados vs. realidad |
| **Matemático Precision** | Cálculos correctos | ⏳ VALIDAR | Verificar ARV, ROI, cap rates |

**Validación:** 
- Semanal mientras está en Sonnet
- Si Confidence Score promedio <7.0 → revertir a Opus
- Si Scout/Matemático fallan → investigar caso específico

**Fallback:** Si un deal individual tiene issues → invocar Fact-Checker con Opus para revalidar

---

## 🟢 FASE 3 — SOCIAL MEDIA (Sonnet)

| Métrica | Umbral | Status | Notas |
|---------|--------|--------|-------|
| **Visual Quality** | Professional | ⏳ Por monitorear | Revisar 2-3 carruseles |
| **Copy Quality** | Bilingual EN/ES | ⏳ Por monitorear | Captions deben tener hook |
| **Compliance** | Pinnacle branding | ⏳ Por monitorear | Hashtags, tone correct |

**Validación:** Spot-check de 1-2 contenidos por semana

---

## 📋 CHECKLIST SEMANAL

**Cada lunes (después de cron Airtable):**

```
□ Tracy: Verificar que registros migraron de Tracy → Contacts
□ Deals: Muestrear 1-2 deals y revisar Confidence Scores
□ Scout: Spot-check que datos de mercado son reales/correctos
□ Social Media: Revisar 1 carrusel + 1 video publicado
□ Errores: Revisar logs de Telegram bot y el_polling.log

ACCIÓN SI PROBLEMA DETECTADO:
  → Documentar en memoria_ALex.md
  → Escalar a Jefe si score <6.0 o error >2%
  → Cambiar a Opus fallback para ese componente
```

---

## 📊 COSTOS REALES vs PRESUPUESTO

| Periodo | Presupuesto | Real | Diferencia |
|---------|-------------|------|-----------|
| Abril (partial) | $308.22 | ⏳ Por calcular | TBD |
| Mayo | $1,236.90 | ⏳ | TBD |
| Junio | $1,236.90 | ⏳ | TBD |

---

## 🚨 ALERTAS AUTOMÁTICAS

Si se detecta:
- ❌ Confidence Score promedio <6.0 → Alerta CRÍTICA
- ❌ Scout error rate >5% → Alerta ALTA
- ❌ Matemático calcula negativo ROI en mercado viable → Alerta MEDIA
- ❌ Fact-Checker marca >2 deals con mismo error → Alerta MEDIA

**Acción:** Notificar Jefe vía Telegram + incluir en memoria_ALex.md

---

## 🎯 METAS DE AHORRO

```
Mes 1 (Abril):   ~$2,500 ahorrado (por implementación tardía)
Mes 2 (Mayo):    $3,100 ahorrado (meta)
Mes 3+ (Junio):  $3,100/mes sostenido (meta)

ANUAL: $37,195 ahorrado = inversión en validación y monitoreo
```

---

## 📝 HISTORIAL DE CAMBIOS

```
2026-04-10 08:00  ✅ Implementadas todas las fases
2026-04-10 08:15  ✅ Validación dashboard creado
2026-04-10 08:30  ⏳ Monitoreo inicia — primer reporte en 1 semana
```

---

## 🔧 CÓMO REVERTIR SI ALGO FALLA

Si cualquier fase falla y necesita revertir:

**Para Tracy (Haiku → Opus):**
```python
# En model_assignment.py, línea:
"tracy": "opus",  # Revertir
```

**Para Deals (Sonnet → Opus):**
```python
"scout": "opus",           # Revertir
"matematico": "opus",      # Revertir
"fact-checker": "opus",    # Revertir
```

**Para Social Media (Sonnet → Opus):**
```python
"creativo": "opus",        # Revertir
"director": "opus",        # Revertir
```

Luego: `git add agents/model_assignment.py && git commit -m "fix: revert from Sonnet to Opus — [reason]"`

---

**Responsable de Monitoreo:** ALEX  
**Reportar a:** Jorge Cruz (vía Telegram)  
**Frecuencia:** Semanal (lunes mañana)  
**Escalation:** Si score <6.0 o error >2%
