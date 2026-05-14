# AIRTABLE — Herramienta de Acceso a Base de Datos

## CREDENCIALES

```
AIRTABLE_TOKEN:   [REDACTED_AIRTABLE_PAT]
AIRTABLE_BASE_ID: [REDACTED_AIRTABLE_BASE_ID]
```

Base URL de la API: `https://api.airtable.com/v0`

Header de autenticación siempre:
```
Authorization: Bearer [REDACTED_AIRTABLE_PAT]
Content-Type: application/json
```

---

## MAPA DE TABLAS

### 1. CONTACTS — `[REDACTED_AIRTABLE_TABLE_ID]`
Contactos de propietarios, compradores, vendedores y relacionados.

| Campo | Tipo | Notas |
|-------|------|-------|
| `Full Name` | singleLineText (PK) | Nombre completo |
| `Phone1` | number | E.164 sin + (ej: 18594757302) — primary_phone de Tracerfy |
| `Phone1 Type` | singleLineText | primary_phone_type (Mobile, Landline) |
| `Phone2` | number | E.164 — mobile_1 de Tracerfy |
| `Phone3` | number | E.164 — mobile_2 de Tracerfy |
| `Phone4` | number | E.164 — landline_1 de Tracerfy |
| `Email1` | email | email_1 de Tracerfy |
| `Email2` | email | email_2 de Tracerfy |
| `Email3` | email | email_3 de Tracerfy |
| `Owner Address` | multilineText | Dirección de la propiedad rastreada |
| `Mail Address` | singleLineText | mail_address de Tracerfy |
| `Mail City` | singleLineText | mail_city de Tracerfy |
| `Mail State` | singleLineText | mail_state de Tracerfy |
| `Mail Zip` | singleLineText | mail_zip de Tracerfy |
| `Tracerfy ID` | number | id del registro en Tracerfy (deduplicación) |
| `Category` | singleSelect | Seller, Cash Buyer, Contractor, Client, Supplier, Lead, Partner |
| `Owner Type` | singleSelect | Individual, Joint, LLC, Trust, Agent, Corporation, Probate |
| `Lead Source` | singleSelect | ATTOM + Tracerfy, Direct Find, Court Record, Deal Driven, Website Form, Skip Trace - Tracy |
| `Stage` | singleSelect | New, Dead, To Be Contacted, Analized, Contacted, Offer Sent, Under Contract, Deal Done, Closing, Review This Deal |
| `Listing Agent Name` | singleLineText | |
| `Listing Agent Phone` | phoneNumber | |
| `Listing Agent Email` | email | |
| `Listing Agent Address` | singleLineText | |
| `Best time to call` | singleSelect | Morning, Afternoon, Evening |
| `Preferred contact method` | singleSelect | Phone, Email, Text, WhatsApp |
| `Lenguage` | singleSelect | English, Spanish |
| `Do not contact` | checkbox | true/false |
| `Last contact date` | date | formato: YYYY-MM-DD |
| `Next follow up date` | date | formato: YYYY-MM-DD |
| `Negotiation notes` | multilineText | |
| `Attorney name` | singleLineText | |
| `Attorney phone` | phoneNumber | |
| `Attorney email` | email | |
| `Relationship to property` | singleSelect | Owner, Heirs, POA, Executor |
| `Deals` | multipleRecordLinks → Deals | |
| `Property Address` | multipleRecordLinks → Deals | |
| `Notes & Activity` | multipleRecordLinks → Notes & Activity | |

---

### 2. LEADS — `[REDACTED_AIRTABLE_TABLE_ID]`
Leads de propiedades en análisis y seguimiento.

| Campo | Tipo | Notas |
|-------|------|-------|
| `Address` | singleLineText (PK) | Dirección principal |
| `Stage` | singleSelect | New Lead, Contacted, Appointment Set, Offer Sent, Under Contract, Closing, Done Deal, Dead, Review this Deal, To be Contacted |
| `City` | singleLineText | |
| `Estate` | singleLineText | Estado (WI, IL, etc.) |
| `Zip Code` | number | |
| `Property Type` | singleSelect | Single Family, Multi-Family, Commercial, Manufactured, Vacant Land, Condo, Other |
| `Bedrooms` | number | |
| `Bathroom` | number | |
| `SF Footage` | number | Pies cuadrados |
| `Lot Size` | number | |
| `Year Build` | number | |
| `Assessed Value` | currency | |
| `Tax Delinquency Amount` | currency | |
| `Last Sale Price` | currency | |
| `Tax Delinquency / Foreclosure` | singleLineText | Indicador |
| `Foreclosure Stage` | singleLineText | |
| `Absentee Owner` | singleSelect | Yes, No, Renter, Other |
| `Asking Price` | currency | |
| `ARV` | currency | After Repair Value |
| `Repair stimate` | currency | Estimado de reparaciones |
| `Max Offer` | formula | (ARV * 0.65) - Repairs |
| `Flip Profit` | formula | Ganancia proyectada |
| `Recomendation` | singleLineText | |
| `Listing URL` | url | |
| `Dated Added` | date | formato: YYYY-MM-DD |
| `Lead Source` | singleLineText | |
| `Confidence Score` | singleLineText | |
| `Analisys Report URL` | url | |
| `Zillow Url` | url | |
| `Redfin Url` | url | |
| `Seller Phone` | phoneNumber | |
| `Seller Email` | email | |

---

### 3. DEALS — `[REDACTED_AIRTABLE_TABLE_ID]`
Deals activos en pipeline de inversión.

| Campo | Tipo | Notas |
|-------|------|-------|
| `Property Address` | singleLineText (PK) | |
| `Citi` | singleLineText | Ciudad |
| `Estate` | singleLineText | Estado |
| `Zip Code` | number | |
| `Property Type` | singleSelect | Single Family, Multifamily, Condo, Commercial, Multi-Family, Vacant Land, Manufactured |
| `Pipeline Stage` | singleSelect | New Lead, Contacted, Appt Set, Analysis, Offer Sent, Under Contract, Closing, Dead, Review This Deal |
| `ARV` | currency | |
| `Asking Price` | currency | |
| `Est. Repairs` | currency | |
| `Max Allowable Offer (MAO)` | currency | |
| `Purchase Price` | currency | Precio negociado final |
| `Projected Profit` | currency | |
| `ROI %` | percent | |
| `Seller Motivation` | multilineText | |
| `Property Conditions` | multilineText | |
| `Legal Situation` | multilineText | |
| `Inspection Notes` | multilineText | |
| `Remodeling Cost` | currency | Costo real de remodelación |
| `Contract Date` | date | |
| `Closing Date` | date | |
| `Zillow Link` | url | |
| `Redfin Link` | url | |
| `Attention Flag` | singleLineText | |
| `Analysis Report URL` | url | |
| `Contacts` | multipleRecordLinks → Contacts | |
| `Contacts 2` | multipleRecordLinks → Contacts | |
| `Notes & Activity` | multipleRecordLinks → Notes & Activity | |
| `Property Photos` | multipleAttachments | |
| `Inspection Report` | multipleAttachments | |
| `Purchase Contract` | multipleAttachments | |
| `Repair Estimates` | multipleAttachments | |
| `Closing Documents` | multipleAttachments | |

---

### 4. NOTES & ACTIVITY — `[REDACTED_AIRTABLE_TABLE_ID]`
Log de actividad: llamadas, visitas, emails, ofertas.

| Campo | Tipo | Notas |
|-------|------|-------|
| `Note Title` | singleLineText (PK) | |
| `Date` | date | formato: YYYY-MM-DD |
| `Type` | singleSelect | Call, Visit, Email, Offer, Contract, Other |
| `Property Address` | multipleRecordLinks → Deals | |
| `Call Logs` | multilineText | Transcript o notas de llamada |
| `Seller Motivation` | multilineText | |
| `Property Condition` | multilineText | |
| `Stage` | singleSelect | New, In Process, Dead |
| `Contact Name` | multipleRecordLinks → Contacts | |
| `Duration` | duration | hh:mm |
| `Outcome` | singleSelect | Positive, Neutral, Negative, No answer |
| `Next action` | multilineText | |
| `Offer amount` | currency | |
| `Counter offer` | currency | |
| `Asking price at time` | currency | |
| `Follow up required` | checkbox | true/false |
| `Recorded call` | multipleAttachments | |

---

### 5. TRACY — `[REDACTED_AIRTABLE_TABLE_ID]`
Log de auditoría de todos los intentos de skip tracing ejecutados por Tracy.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | autoNumber | ID automático |
| `address` | singleLineText | Dirección de la propiedad rastreada |
| `city` | singleLineText | Ciudad |
| `state` | singleLineText | Estado (WI, IL, etc.) |
| `zip` | singleLineText | Código postal |
| `first_name` | singleLineText | Nombre del dueño (si se conoce antes del rastreo) |
| `last_name` | singleLineText | Apellido del dueño |
| `mail_address` | singleLineText | Dirección postal del dueño |
| `mail_city` | singleLineText | Ciudad de la dirección postal |
| `mail_state` | singleLineText | Estado de la dirección postal |
| `fecha_rastreo` | dateTime | Fecha/hora del intento — formato ISO 8601 |
| `status` | singleSelect | `pending`, `success`, `error` |
| `resultado` | multilineText | Resumen de contactos encontrados o mensaje de error |
| `notas` | multilineText | Observaciones del rastreo (relatives, errores parciales, etc.) |

**Flujo de uso:**
1. Tracy crea el registro con `status: "pending"` al inicio (Paso 1).
2. Tracy actualiza a `status: "success"` o `"error"` con el resultado al terminar (Paso 5).
3. Consultar antes de rastrear para evitar duplicados (Paso 0).

---

## OPERACIONES DISPONIBLES

### LEER registros de una tabla
```bash
# Todos los registros (máx 100)
curl -s "https://api.airtable.com/v0/[REDACTED_AIRTABLE_BASE_ID]/{TABLE_ID}" \
  -H "Authorization: Bearer [REDACTED_AIRTABLE_PAT]"

# Filtrar por campo (ejemplo: leads en Stage = "New Lead")
curl -s "https://api.airtable.com/v0/[REDACTED_AIRTABLE_BASE_ID]/{TABLE_ID}?filterByFormula={Stage}='New Lead'" \
  -H "Authorization: Bearer [REDACTED_AIRTABLE_PAT]"

# Ordenar y limitar
curl -s "https://api.airtable.com/v0/[REDACTED_AIRTABLE_BASE_ID]/{TABLE_ID}?maxRecords=10&sort[0][field]=Dated%20Added&sort[0][direction]=desc" \
  -H "Authorization: Bearer [REDACTED_AIRTABLE_PAT]"
```

### CREAR un nuevo registro
```bash
curl -s -X POST "https://api.airtable.com/v0/[REDACTED_AIRTABLE_BASE_ID]/{TABLE_ID}" \
  -H "Authorization: Bearer [REDACTED_AIRTABLE_PAT]" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"Campo1": "valor1", "Campo2": "valor2"}}'
```

### ACTUALIZAR un registro existente (necesitas el record ID: recXXXXXXXXXXXXXX)
```bash
curl -s -X PATCH "https://api.airtable.com/v0/[REDACTED_AIRTABLE_BASE_ID]/{TABLE_ID}/{RECORD_ID}" \
  -H "Authorization: Bearer [REDACTED_AIRTABLE_PAT]" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"Campo": "nuevo_valor"}}'
```

### BUSCAR un registro por valor de campo
```bash
curl -s "https://api.airtable.com/v0/[REDACTED_AIRTABLE_BASE_ID]/{TABLE_ID}?filterByFormula=SEARCH('texto_a_buscar',{NombreCampo})" \
  -H "Authorization: Bearer [REDACTED_AIRTABLE_PAT]"
```

### CREAR MÚLTIPLES registros en una sola llamada (hasta 10)
```bash
curl -s -X POST "https://api.airtable.com/v0/[REDACTED_AIRTABLE_BASE_ID]/{TABLE_ID}" \
  -H "Authorization: Bearer [REDACTED_AIRTABLE_PAT]" \
  -H "Content-Type: application/json" \
  -d '{"records": [{"fields": {"Campo": "valor1"}}, {"fields": {"Campo": "valor2"}}]}'
```

---

## REGLAS DE USO

1. **Nunca envíes campos vacíos** — omite completamente los campos sin valor en el JSON.
2. **Fechas siempre en formato** `YYYY-MM-DD`.
3. **Campos singleSelect** — el valor debe coincidir EXACTAMENTE con una de las opciones listadas (mayúsculas/minúsculas importan).
4. **Campos linkedRecord** — requieren un array de record IDs: `["recXXXXXX", "recYYYYYY"]`.
5. **Verifica siempre la respuesta** — éxito devuelve `"id": "rec..."`, error devuelve `"error": {...}`.
6. **Rate limit** — máximo 5 requests/segundo. Si hay muchos registros, agrega `sleep 0.2` entre llamadas.
