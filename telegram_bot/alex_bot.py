"""
ALEX — Telegram Bot (Full Capabilities)
Real Estate Investment AI Assistant

Capacidades completas:
- Sub-agentes inmobiliarios: El Scout, El Matemático, El Fact-Checker, Tracy
- Sub-agentes Social Media: Social Media Agent, El Creativo, El Director, El Programador
- Blotato REST API: generación de visuals/videos + publicación en FB/IG (programada)
- Airtable: lectura y escritura completa (CRM + Social Media base)
- Web fetch: El Scout puede obtener datos reales de mercado
- Memoria compartida: memoria_ALex.md + telegram_memory.md
- Multimedia: texto, voz (Whisper), fotos (Claude Vision), videos

Pipeline Social Media desde Telegram:
  Social Media Agent → El Creativo (imágenes) + El Director (videos) → El Programador (FB+IG)
"""

import os
import sys
import asyncio
import base64
import json
import logging
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from functools import partial

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ .env loaded from {env_path}")
    else:
        print(f"⚠️ .env not found at {env_path}")
except ImportError as e:
    print(f"⚠️ dotenv import failed: {e}")

try:
    import requests as http_requests
except ImportError:
    http_requests = None

from telegram import Update
from telegram.ext import (
    Application, MessageHandler, CommandHandler, filters, ContextTypes,
)
import anthropic

# Import model configuration (audit 2026-04-10)
try:
    sys.path.insert(0, str(Path(__file__).parent.parent / "agents"))
    from model_assignment import get_model, get_model_with_escalation_logging, AGENT_MODELS
    MODEL_CONFIG_LOADED = True
except ImportError:
    MODEL_CONFIG_LOADED = False
    print("⚠️ model_assignment.py not found — using default Sonnet for all agents")

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────
TELEGRAM_TOKEN   = os.getenv("TELEGRAM_TOKEN", "[REDACTED_TELEGRAM_BOT_TOKEN]")
ANTHROPIC_KEY    = os.getenv("ANTHROPIC_KEY")

# Verificar que ANTHROPIC_KEY esté disponible
if not ANTHROPIC_KEY:
    print("❌ ERROR: ANTHROPIC_KEY no encontrada en .env o variables de entorno")
    print(f"   Variables disponibles: {[k for k in os.environ.keys() if 'ANTHROPIC' in k or 'KEY' in k]}")
    raise RuntimeError("ANTHROPIC_KEY es requerida para iniciar el bot")

CLAUDE_MODEL     = "claude-sonnet-4-6"  # Default for general responses
MAX_HISTORY      = 40

AIRTABLE_TOKEN   = os.getenv("AIRTABLE_TOKEN", "[REDACTED_AIRTABLE_PAT]")
AIRTABLE_BASE_ID = "[REDACTED_AIRTABLE_BASE_ID]"
AIRTABLE_BASE_URL = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}"
TRACERFY_API_KEY = os.getenv("TRACERFY_TOKEN", "[REDACTED_JWT]")

BRIDGE_URL   = os.getenv("BRIDGE_URL",   "https://agents.pinnaclegroupwi.com")
ALEX_SECRET  = os.getenv("ALEX_SECRET",  "")
GITHUB_REPO  = "alex-real-estate-system"

# Social Media Agent — Airtable base separada
SM_AIRTABLE_TOKEN    = "[REDACTED_AIRTABLE_PAT]"
SM_AIRTABLE_BASE_ID  = "[REDACTED_AIRTABLE_BASE_ID]"
SM_AIRTABLE_BASE_URL = f"https://api.airtable.com/v0/{SM_AIRTABLE_BASE_ID}"
SM_MAKE_WEBHOOK      = "https://hook.us2.make.com/zbvy7391qh9n7dlmw1hy8pq9ym69obxk"
SM_TABLE_IDS = {
    "Ideas de Contenido": "[REDACTED_AIRTABLE_TABLE_ID]",
    "Publicaciones":      "[REDACTED_AIRTABLE_TABLE_ID]",
    "Scripts de Video":   "[REDACTED_AIRTABLE_TABLE_ID]",
}

# Blotato — Social Media Publishing
BLOTATO_API_KEY      = os.getenv("BLOTATO_API_KEY", "blt_2Jz5IZHqjY6WzhfTWkDVskRANpeibfXkyDTvUB+mn8k=")
BLOTATO_BASE_URL     = "https://backend.blotato.com/v2"
BLOTATO_FB_ACCOUNT   = "25638"
BLOTATO_FB_PAGE_ID   = "965320503341457"
BLOTATO_IG_ACCOUNT   = "39285"
BLOTATO_SLIDE_TPL    = "53cfec04-2500-41cf-8cc1-ba670d2c341a"   # AI Slide Generator (carruseles/posts)
BLOTATO_STORY_TPL    = "/base/v2/ai-story-video/5903fe43-514d-40ee-a060-0d6628c5f8fd/v1"
BLOTATO_SELFIE_TPL   = "/base/v2/ai-selfie-video/57f5a565-fd17-458b-be43-4a2d8ccaca75/v1"

TABLE_IDS = {
    "Contacts":         "[REDACTED_AIRTABLE_TABLE_ID]",
    "Leads":            "[REDACTED_AIRTABLE_TABLE_ID]",
    "Deals":            "[REDACTED_AIRTABLE_TABLE_ID]",
    "Notes & Activity": "[REDACTED_AIRTABLE_TABLE_ID]",
    "Tracy":            "[REDACTED_AIRTABLE_TABLE_ID]",
}

# Directorios del proyecto
PROJECT_DIR     = Path(__file__).parent.parent
CLAUDE_MD       = PROJECT_DIR / "CLAUDE.md"
MEMORIA_ALEX    = PROJECT_DIR / "memoria_ALex.md"
TELEGRAM_MEM    = PROJECT_DIR / "telegram_bot" / "telegram_memory.md"
SESSIONS_DIR    = PROJECT_DIR / "telegram_bot" / "sessions"
AGENTS_DIR      = PROJECT_DIR / "agents"
PROTOCOLO_SEG   = PROJECT_DIR / "agents" / "protocolo_seguro.md"
COLA_MENSAJES   = PROJECT_DIR / "agents" / "cola_mensajes.md"
ALERT_SCRIPT    = PROJECT_DIR / "agents" / "alerta_telegram.sh"
SHARED_CONV     = PROJECT_DIR / "agents" / "shared_conversation.json"
OWNER_CHAT_ID   = "8402370952"
SHARED_CONV_MAX = 60  # máximo de mensajes a guardar en historial compartido

SESSIONS_DIR.mkdir(exist_ok=True)

# ─────────────────────────────────────────────
# LOGGING & CLIENTE
# ─────────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
conversation_history: dict[int, list] = {}
whisper_model = None


# ─────────────────────────────────────────────
# AGENT PROMPTS
# ─────────────────────────────────────────────

def load_agent_prompt(agent_name: str) -> str:
    path = AGENTS_DIR / f"{agent_name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return f"Eres el sub-agente {agent_name} del equipo ALEX de inversión inmobiliaria. Sigue las instrucciones del Orquestador."


# ─────────────────────────────────────────────
# TOOL DEFINITIONS — Lo que ALEX puede invocar
# ─────────────────────────────────────────────

TOOLS = [
    {
        "name": "invoke_scout",
        "description": (
            "Invoca a El Scout para investigar el mercado de una propiedad o zona. "
            "Devuelve JSON con datos de mercado, comparables, estimación de rentas y riesgos. "
            "Úsalo SIEMPRE que el usuario pida analizar una propiedad o zona de inversión."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "property_data": {
                    "type": "string",
                    "description": "Datos completos de la propiedad: dirección, zip code, tipo, precio listado, tamaño estimado, condición"
                },
                "strategy": {
                    "type": "string",
                    "description": "Estrategia de inversión: Fix & Flip, Buy & Hold, BRRRR, Wholesale, Multifamily"
                }
            },
            "required": ["property_data", "strategy"]
        }
    },
    {
        "name": "invoke_matematico",
        "description": (
            "Invoca a El Matemático para el underwriting financiero completo. "
            "Calcula ARV, rehab, holding costs, profit, ROI, cashflow, cap rate y stress tests. "
            "Úsalo después de El Scout (o en paralelo si ya tienes suficientes datos)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "property_data": {
                    "type": "string",
                    "description": "Datos de la propiedad incluyendo precio de compra y características"
                },
                "scout_json": {
                    "type": "string",
                    "description": "JSON output de El Scout (puede estar vacío si no está disponible)"
                },
                "strategy": {
                    "type": "string",
                    "description": "Estrategia de inversión"
                }
            },
            "required": ["property_data", "strategy"]
        }
    },
    {
        "name": "invoke_fact_checker",
        "description": (
            "Invoca a El Fact-Checker para auditar el deal y asignar Confidence Score (1-10). "
            "Detecta sesgos optimistas, valida comps y determina el veredicto final. "
            "Úsalo SIEMPRE después de El Scout y El Matemático."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "property_data": {"type": "string"},
                "scout_json": {
                    "type": "string",
                    "description": "JSON completo de El Scout"
                },
                "matematico_json": {
                    "type": "string",
                    "description": "JSON completo de El Matemático"
                }
            },
            "required": ["property_data", "scout_json", "matematico_json"]
        }
    },
    {
        "name": "invoke_tracy",
        "description": (
            "Invoca a Tracy para skip tracing de una dirección de propiedad. "
            "Busca al dueño y sus familiares en Tracerfy y escribe los contactos directamente en Airtable (tabla Contacts). "
            "Úsalo cuando el usuario pida skip trace o buscar el dueño de una propiedad."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "address":  {"type": "string", "description": "Calle y número (e.g. '123 Main St')"},
                "city":     {"type": "string", "description": "Ciudad"},
                "state":    {"type": "string", "description": "Abreviatura del estado (e.g. 'WI')"},
                "zip_code": {"type": "string", "description": "Código postal"}
            },
            "required": ["address"]
        }
    },
    {
        "name": "airtable_list",
        "description": "Lee registros de una tabla de Airtable. Úsalo para buscar leads, deals, contactos o actividades.",
        "input_schema": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "enum": ["Contacts", "Leads", "Deals", "Notes & Activity"],
                    "description": "Nombre de la tabla"
                },
                "filter_formula": {
                    "type": "string",
                    "description": "Fórmula de filtro Airtable (opcional), e.g.: {Stage}='New Lead'"
                },
                "max_records": {
                    "type": "integer",
                    "description": "Máximo de registros a retornar (default: 20)"
                }
            },
            "required": ["table"]
        }
    },
    {
        "name": "airtable_create",
        "description": "Crea un registro nuevo en Airtable. Úsalo para añadir deals, leads, contactos o notas de actividad.",
        "input_schema": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "enum": ["Contacts", "Leads", "Deals", "Notes & Activity"]
                },
                "fields": {
                    "type": "object",
                    "description": "Campos del registro. Los nombres deben coincidir exactamente con las columnas de Airtable."
                }
            },
            "required": ["table", "fields"]
        }
    },
    {
        "name": "airtable_update",
        "description": "Actualiza un registro existente en Airtable por su record_id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "enum": ["Contacts", "Leads", "Deals", "Notes & Activity"]
                },
                "record_id": {
                    "type": "string",
                    "description": "ID del registro Airtable (empieza con 'rec')"
                },
                "fields": {
                    "type": "object",
                    "description": "Campos a actualizar con sus nuevos valores"
                }
            },
            "required": ["table", "record_id", "fields"]
        }
    },
    {
        "name": "airtable_sm_list",
        "description": "Lee registros de la base Social Media de Airtable (Pinnacle). Úsalo para ver ideas de contenido, publicaciones programadas o el calendario de social media.",
        "input_schema": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "enum": ["Ideas de Contenido", "Publicaciones"],
                    "description": "Tabla de Social Media a consultar"
                },
                "filter_formula": {
                    "type": "string",
                    "description": "Fórmula de filtro Airtable (opcional), e.g.: {Semana}=2 o {Status}='Nueva'"
                },
                "max_records": {
                    "type": "integer",
                    "description": "Máximo de registros a retornar (default: 20)"
                }
            },
            "required": ["table"]
        }
    },
    {
        "name": "airtable_sm_create",
        "description": "Crea un registro en la base Social Media de Airtable. Úsalo para guardar ideas de contenido o publicaciones directamente sin pasar por Make.com.",
        "input_schema": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "enum": ["Ideas de Contenido", "Publicaciones"],
                    "description": "Tabla donde crear el registro"
                },
                "fields": {
                    "type": "object",
                    "description": "Campos del registro. Para 'Ideas de Contenido' usar: 'Título de Idea', 'Hook', 'Mensaje Principal', 'CTA', '🇺🇸 Caption EN', '🇲🇽 Caption ES', 'Hashtags', 'Formato' (Post|Reel|Carrusel|Story), 'Plataforma' (FB|IG|AMBAS), 'Tipo' (Educativo|Promocional|Personal), 'Status' (Nueva), 'Semana' (número)"
                }
            },
            "required": ["table", "fields"]
        }
    },
    {
        "name": "airtable_sm_update",
        "description": "Actualiza un registro existente en la base Social Media de Airtable por su record_id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "table": {
                    "type": "string",
                    "enum": ["Ideas de Contenido", "Publicaciones"],
                    "description": "Tabla del registro a actualizar"
                },
                "record_id": {
                    "type": "string",
                    "description": "ID del registro Airtable (empieza con 'rec')"
                },
                "fields": {
                    "type": "object",
                    "description": "Campos a actualizar con sus nuevos valores"
                }
            },
            "required": ["table", "record_id", "fields"]
        }
    },
    {
        "name": "read_memoria",
        "description": "Lee la memoria operacional de ALEX (memoria_ALex.md). Contiene deals analizados, zip codes, lecciones aprendidas, flags de riesgo. Úsalo al inicio de cada análisis.",
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "write_memoria",
        "description": "Escribe nuevos aprendizajes en la memoria operacional de ALEX (memoria_ALex.md). Úsalo después de completar un análisis de deal.",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Contenido a añadir. Incluye fecha YYYY-MM-DD y puntos concisos sobre el deal, lecciones y flags."
                }
            },
            "required": ["content"]
        }
    },
    {
        "name": "web_fetch",
        "description": "Fetches a URL and returns the page content. Use to get real-time market data from Zillow, Redfin, Realtor.com, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url":     {"type": "string", "description": "URL completa a fetchear"},
                "purpose": {"type": "string", "description": "Para qué sirve este fetch (logging)"}
            },
            "required": ["url"]
        }
    },
    {
        "name": "invoke_social_media",
        "description": (
            "Invoca al Social Media Agent para generar contenido de redes sociales de Pinnacle Holdings. "
            "Puede generar posts, reels, carruseles y stories para Facebook e Instagram. "
            "Puede guardar ideas en Airtable y enviar al webhook de Make.com. "
            "Úsalo cuando el Jefe pida contenido para redes sociales, ideas de posts, captions, o gestión del calendario de contenido."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "Descripción de lo que se necesita: generar contenido, crear idea, guardar en Airtable, ver calendario, etc."
                },
                "platform": {
                    "type": "string",
                    "enum": ["FB", "IG", "Ambas", "LinkedIn"],
                    "description": "Plataforma objetivo (default: Ambas)"
                },
                "format_type": {
                    "type": "string",
                    "enum": ["Post", "Reel", "Carrusel", "Story"],
                    "description": "Formato del contenido (default: Post)"
                },
                "save_to_airtable": {
                    "type": "boolean",
                    "description": "Si true, guarda la idea generada en Airtable automáticamente (default: false)"
                },
                "week_number": {
                    "type": "integer",
                    "description": "Número de semana del calendario de contenido (1-4)"
                }
            },
            "required": ["task"]
        }
    },
    {
        "name": "invoke_claude_code",
        "description": (
            "LAST RESORT — solo cuando ninguna otra tool sirve. "
            "Antes de invocar esto, intenta resolver con: airtable_list/create/update, "
            "airtable_sm_list/create/update, web_fetch, read_memoria, write_memoria, "
            "invoke_scout, invoke_matematico, invoke_fact_checker, invoke_tracy, "
            "invoke_social_media, invoke_creativo, invoke_director, invoke_programador. "
            "Úsalo SOLO si la tarea requiere uno de: ejecutar bash/shell, editar archivos del repo, "
            "git operations (commit/push/branch), instalar dependencias, modificar workflows GHA, "
            "depurar código en producción. Cualquier otra tarea: usa una tool especializada arriba."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "Descripción detallada de la tarea técnica a realizar. Incluye contexto relevante, archivos involucrados, y el resultado esperado."
                },
                "context": {
                    "type": "string",
                    "description": "Contexto adicional opcional: datos del deal, resultados de otros agentes, o información que Claude Code necesite para completar la tarea."
                }
            },
            "required": ["task"]
        }
    },
    {
        "name": "invoke_creativo",
        "description": (
            "Dispara El Creativo vía GitHub Actions (workflow_dispatch sobre agents-cron.yml). "
            "Pipeline real: themes.mjs (5 temas T1-T5) + Playwright Chromium → PNG 1080×1350 → "
            "Cloudinary upload → Airtable PATCH visual_url. NO usa Blotato/Nano Banana (regla R10 — "
            "AI imagen aluciona texto en español). El runner remoto lee Airtable directamente — el bot solo dispara.\n"
            "\n"
            "DOS MODOS según el parámetro record_id:\n"
            "  • Sin record_id → mode=batch: procesa hasta 3 ideas pendientes "
            "(Status=Nueva/Aprobada/En Produccion, visual_url vacío, Visual_Prompt no vacío, NO Reel/Video). "
            "Úsalo para 'generar visuales', 'corre el creativo', 'procesa el backlog'.\n"
            "  • Con record_id → mode=one (regenerate): regenera el visual de ESE registro específico, "
            "incluso si ya tenía visual_url (lo sobreescribe). "
            "Úsalo cuando el Jefe pida 'regenera el visual de recXXX', 'rehazlo', 'cambia el visual de la idea X', "
            "o cuando rechace un visual y haya que producir uno nuevo. Extrae el record_id del mensaje del Jefe "
            "(empieza con 'rec', 17 caracteres alfanuméricos)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "Descripción de la tarea (e.g. 'generar visuals pendientes' o 'regenerar visual de recXXX')"
                },
                "record_id": {
                    "type": "string",
                    "description": "Airtable record_id específico (formato 'recXXXXXXXXXXXXXXX'). Si presente, dispara mode=one (regenera ese registro). Si vacío, dispara mode=batch (procesa pendientes en cola)."
                }
            },
            "required": ["task"]
        }
    },
    {
        "name": "invoke_director",
        "description": (
            "Dispara El Director v2 vía GitHub Actions (workflow_dispatch sobre agents-cron.yml). "
            "Pipeline real: faceless Reels — Airtable read (Formato=Reel) → narrative_B expand → "
            "Pexels stock + Nano Banana/Flux Schnell para hero → Puppeteer scene render + ffmpeg "
            "composite (zoompan + crossfade + música) → Cloudinary upload → Airtable PATCH visual_url. "
            "NO usa Blotato (regla R10 — AI imagen aluciona texto en español). "
            "El runner remoto lee Airtable directamente — el bot solo dispara.\n"
            "\n"
            "DOS MODOS según el parámetro record_id:\n"
            "  • Sin record_id → mode=batch: procesa hasta 10 Reels pendientes "
            "(Formato=Reel, Status=Nueva, Visual_Prompt set, visual_url empty, Error_Reason empty). "
            "Úsalo para 'genera los reels', 'corre el director', 'procesa reels pendientes'.\n"
            "  • Con record_id → mode=one: regenera el Reel de ESE registro específico. "
            "Úsalo cuando el Jefe pida 'regenera el reel de recXXX', 'rehaz ese video', "
            "o cuando rechace un video y haya que producir uno nuevo. Extrae el record_id del mensaje "
            "(empieza con 'rec', 17 caracteres alfanuméricos).\n"
            "\n"
            "PENDIENTE: branch HeyGen para 'Jorge habla' (avatar) — esperando API key del Jefe. "
            "Mientras tanto el Director v2 hace solo faceless con texto + música."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "Descripción de la tarea (e.g. 'generar reels pendientes' o 'regenerar reel de recXXX')"
                },
                "record_id": {
                    "type": "string",
                    "description": "Airtable record_id específico (formato 'recXXXXXXXXXXXXXXX'). Si presente, regenera ese registro. Si vacío, batch (procesa pendientes en cola)."
                }
            },
            "required": ["task"]
        }
    },
    {
        "name": "invoke_programador",
        "description": (
            "Invoca a El Programador para publicar posts en Facebook e Instagram via Blotato. "
            "Lee registros de Airtable Social Media con visual_url listo y sin Blotato_Post_IDs, "
            "calcula el siguiente slot disponible (Mar/Jue/Sáb 10am CST), "
            "programa el post en FB e IG, y actualiza Airtable con los IDs de publicación. "
            "Úsalo cuando el Jefe pida publicar contenido, programar posts, o como último paso del pipeline de Social Media."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "Descripción de la tarea: 'publicar lo que hay', 'programar posts pendientes', etc."
                },
                "record_id": {
                    "type": "string",
                    "description": "ID específico de Airtable a procesar (opcional)"
                }
            },
            "required": ["task"]
        }
    }
]

# Herramientas disponibles para El Scout (solo web_fetch)
SCOUT_TOOLS = [t for t in TOOLS if t["name"] == "web_fetch"]

PROGRESS_MESSAGES = {
    "invoke_scout":        "🔍 *El Scout* investigando el mercado...",
    "invoke_matematico":   "🧮 *El Matemático* calculando el underwriting...",
    "invoke_fact_checker": "🔎 *El Fact-Checker* auditando el deal...",
    "invoke_tracy":        "👤 *Tracy* buscando al propietario en Tracerfy...",
    "invoke_social_media": "📱 *Social Media Agent* generando contenido...",
    "invoke_claude_code":  "💻 *Claude Code* procesando tarea técnica...",
    "invoke_creativo":     "🎨 *El Creativo* disparado vía GHA (Puppeteer + themes.mjs)...",
    "invoke_director":     "🎬 *El Director v2* disparado vía GHA (Pexels + Nano Banana + ffmpeg)...",
    "invoke_programador":  "📅 *El Programador* publicando en FB+IG...",
    "airtable_list":       "📋 Consultando Airtable CRM...",
    "airtable_create":     "💾 Guardando en Airtable CRM...",
    "airtable_update":     "✏️ Actualizando Airtable CRM...",
    "airtable_sm_list":    "📋 Consultando Airtable Social Media...",
    "airtable_sm_create":  "💾 Guardando en Airtable Social Media...",
    "airtable_sm_update":  "✏️ Actualizando Airtable Social Media...",
    "read_memoria":       "🧠 Leyendo memoria operacional...",
    "write_memoria":      "💾 Guardando aprendizajes en memoria...",
    "web_fetch":          "🌐 Obteniendo datos de la web...",
}


# ─────────────────────────────────────────────
# TOOL IMPLEMENTATION FUNCTIONS (SYNC)
# ─────────────────────────────────────────────

def _airtable_headers() -> dict:
    return {
        "Authorization": f"Bearer {AIRTABLE_TOKEN}",
        "Content-Type": "application/json"
    }


def _tool_airtable_list(table: str, filter_formula: str = None, max_records: int = 20) -> str:
    if not http_requests:
        return "Error: librería 'requests' no instalada. Ejecuta: pip install requests"
    table_id = TABLE_IDS.get(table)
    if not table_id:
        return json.dumps({"error": f"Tabla '{table}' no encontrada. Tablas disponibles: {list(TABLE_IDS.keys())}"})
    params = {"maxRecords": str(max_records)}
    if filter_formula:
        params["filterByFormula"] = filter_formula
    try:
        resp = http_requests.get(
            f"{AIRTABLE_BASE_URL}/{table_id}",
            headers=_airtable_headers(),
            params=params,
            timeout=30
        )
        data = resp.json()
        if "error" in data:
            return json.dumps({"error": data["error"], "message": data.get("message", "")})
        records = data.get("records", [])
        return json.dumps({"table": table, "count": len(records), "records": records}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def _tool_airtable_create(table: str, fields: dict) -> str:
    if not http_requests:
        return "Error: librería 'requests' no instalada."
    table_id = TABLE_IDS.get(table)
    if not table_id:
        return json.dumps({"error": f"Tabla '{table}' no encontrada."})
    try:
        resp = http_requests.post(
            f"{AIRTABLE_BASE_URL}/{table_id}",
            headers=_airtable_headers(),
            json={"fields": fields},
            timeout=30
        )
        data = resp.json()
        if "error" in data:
            return json.dumps({"error": data["error"], "message": data.get("message", "")})
        return json.dumps({
            "status": "created",
            "record_id": data.get("id"),
            "fields": data.get("fields", {})
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def _tool_airtable_update(table: str, record_id: str, fields: dict) -> str:
    if not http_requests:
        return "Error: librería 'requests' no instalada."
    table_id = TABLE_IDS.get(table)
    if not table_id:
        return json.dumps({"error": f"Tabla '{table}' no encontrada."})
    try:
        resp = http_requests.patch(
            f"{AIRTABLE_BASE_URL}/{table_id}/{record_id}",
            headers=_airtable_headers(),
            json={"fields": fields},
            timeout=30
        )
        data = resp.json()
        if "error" in data:
            return json.dumps({"error": data["error"], "message": data.get("message", "")})
        return json.dumps({"status": "updated", "record_id": data.get("id")}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def _sm_airtable_headers() -> dict:
    return {
        "Authorization": f"Bearer {SM_AIRTABLE_TOKEN}",
        "Content-Type": "application/json"
    }


def _tool_airtable_sm_list(table: str, filter_formula: str = None, max_records: int = 20) -> str:
    if not http_requests:
        return "Error: librería 'requests' no instalada."
    table_id = SM_TABLE_IDS.get(table)
    if not table_id:
        return json.dumps({"error": f"Tabla '{table}' no encontrada. Tablas SM: {list(SM_TABLE_IDS.keys())}"})
    params = {"maxRecords": str(max_records)}
    if filter_formula:
        params["filterByFormula"] = filter_formula
    try:
        resp = http_requests.get(
            f"{SM_AIRTABLE_BASE_URL}/{table_id}",
            headers=_sm_airtable_headers(),
            params=params,
            timeout=30
        )
        data = resp.json()
        if "error" in data:
            return json.dumps({"error": data["error"], "message": data.get("message", "")})
        records = data.get("records", [])
        return json.dumps({"table": table, "count": len(records), "records": records}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def _tool_airtable_sm_create(table: str, fields: dict) -> str:
    if not http_requests:
        return "Error: librería 'requests' no instalada."
    table_id = SM_TABLE_IDS.get(table)
    if not table_id:
        return json.dumps({"error": f"Tabla '{table}' no encontrada."})
    try:
        resp = http_requests.post(
            f"{SM_AIRTABLE_BASE_URL}/{table_id}",
            headers=_sm_airtable_headers(),
            json={"fields": fields},
            timeout=30
        )
        data = resp.json()
        if "error" in data:
            return json.dumps({"error": data["error"], "message": data.get("message", "")})
        return json.dumps({
            "status": "created",
            "record_id": data.get("id"),
            "fields": data.get("fields", {})
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def _tool_airtable_sm_update(table: str, record_id: str, fields: dict) -> str:
    if not http_requests:
        return "Error: librería 'requests' no instalada."
    table_id = SM_TABLE_IDS.get(table)
    if not table_id:
        return json.dumps({"error": f"Tabla '{table}' no encontrada."})
    try:
        resp = http_requests.patch(
            f"{SM_AIRTABLE_BASE_URL}/{table_id}/{record_id}",
            headers=_sm_airtable_headers(),
            json={"fields": fields},
            timeout=30
        )
        data = resp.json()
        if "error" in data:
            return json.dumps({"error": data["error"], "message": data.get("message", "")})
        return json.dumps({"status": "updated", "record_id": data.get("id")}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


def _tool_web_fetch(url: str, purpose: str = "") -> str:
    if not http_requests:
        return "Error: librería 'requests' no instalada."
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = http_requests.get(url, headers=headers, timeout=20)
        content = resp.text
        if len(content) > 10000:
            content = content[:10000] + "\n...[contenido truncado a 10,000 caracteres]"
        return content
    except Exception as e:
        return f"Error fetching {url}: {str(e)}"


def _bridge_read(filename: str) -> str | None:
    """Lee un archivo de GitHub via el bridge de Hostinger."""
    if not http_requests or not BRIDGE_URL:
        return None
    try:
        resp = http_requests.get(
            f"{BRIDGE_URL}/github_bridge.php",
            params={"repo": GITHUB_REPO, "file": filename},
            headers={"X-Alex-Secret": ALEX_SECRET},
            timeout=15
        )
        if resp.status_code == 200 and resp.text.strip():
            return resp.text
        logger.warning(f"[BRIDGE] read {filename}: HTTP {resp.status_code}")
        return None
    except Exception as e:
        logger.warning(f"[BRIDGE] read error ({filename}): {e}")
        return None


def _bridge_write(filename: str, content: str, message: str = "ALEX memory update") -> bool:
    """Escribe un archivo a GitHub via el bridge de Hostinger."""
    if not http_requests or not BRIDGE_URL:
        return False
    try:
        resp = http_requests.post(
            f"{BRIDGE_URL}/github_write.php",
            headers={"X-Alex-Secret": ALEX_SECRET, "Content-Type": "application/json"},
            json={"repo": GITHUB_REPO, "file": filename, "content": content, "message": message},
            timeout=20
        )
        if resp.status_code in (200, 201):
            logger.info(f"[BRIDGE] write {filename}: OK")
            return True
        logger.warning(f"[BRIDGE] write {filename}: HTTP {resp.status_code} — {resp.text[:200]}")
        return False
    except Exception as e:
        logger.warning(f"[BRIDGE] write error ({filename}): {e}")
        return False


def _tool_read_memoria() -> str:
    # Intenta bridge primero (GitHub = fuente de verdad compartida)
    bridge_content = _bridge_read("memoria_ALex.md")
    if bridge_content:
        return bridge_content
    # Fallback: archivo local
    if MEMORIA_ALEX.exists():
        return MEMORIA_ALEX.read_text(encoding="utf-8")
    return "No hay memoria operacional registrada aún."


def _tool_write_memoria(content: str) -> str:
    try:
        existing = MEMORIA_ALEX.read_text(encoding="utf-8") if MEMORIA_ALEX.exists() else ""
        updated = existing + "\n\n" + content if existing.strip() else content
        # Escribe local
        MEMORIA_ALEX.write_text(updated, encoding="utf-8")
        # Empuja a GitHub via bridge
        date_str = datetime.now().strftime("%Y-%m-%d")
        _bridge_write("memoria_ALex.md", updated, f"ALEX memoria update — {date_str}")
        return "✅ Memoria operacional actualizada (local + GitHub)."
    except Exception as e:
        return f"Error escribiendo memoria: {str(e)}"


def _run_subagent_sync(system_prompt: str, user_message: str, tools=None, model: str = None) -> str:
    """
    Runs a sub-agent as a separate synchronous Claude API call.
    Supports a nested tool use loop for tools like web_fetch.

    Args:
        model: Claude model to use (default: CLAUDE_MODEL=sonnet).
               Use "claude-haiku-4-5" for Tracy, "claude-sonnet-4-6" for others.
    """
    if model is None:
        model = CLAUDE_MODEL

    messages = [{"role": "user", "content": user_message}]
    max_iters = 12

    for _ in range(max_iters):
        kwargs = {
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": messages
        }
        if tools:
            kwargs["tools"] = tools

        response = client.messages.create(**kwargs)

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text
            return "Sub-agent returned no text."

        elif response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if hasattr(block, "type") and block.type == "tool_use":
                    if block.name == "web_fetch":
                        result = _tool_web_fetch(
                            block.input.get("url", ""),
                            block.input.get("purpose", "")
                        )
                    else:
                        result = f"Tool '{block.name}' not available inside sub-agent."
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })
            messages.append({"role": "user", "content": tool_results})
        else:
            break

    return "Sub-agent reached max iterations without a final response."


def _tool_invoke_scout(property_data: str, strategy: str) -> str:
    system_prompt = load_agent_prompt("scout")
    user_msg = (
        f"Analiza esta propiedad:\n\n{property_data}\n\n"
        f"Estrategia objetivo: {strategy}\n\n"
        "Investiga el mercado activamente usando web_fetch para obtener datos reales. "
        "Devuelve únicamente el JSON estricto de tu análisis."
    )
    logger.info(f"Invoking El Scout for: {property_data[:80]}...")
    # SMART ESCALATION: Scout starts with Sonnet, escalates to Opus if complex
    if MODEL_CONFIG_LOADED:
        model = get_model_with_escalation_logging(
            agent_name="scout",
            prompt=user_msg,
            task_id=f"scout_{datetime.now().timestamp()}",
            log_to_airtable=True
        )
    else:
        model = CLAUDE_MODEL
    return _run_subagent_sync(system_prompt, user_msg, tools=SCOUT_TOOLS, model=model)


def _tool_invoke_matematico(property_data: str, strategy: str, scout_json: str = "") -> str:
    system_prompt = load_agent_prompt("matematico")
    scout_section = f"\n\nDatos de mercado del Scout:\n{scout_json}" if scout_json else "\n\nDatos del Scout: No disponibles — usa estimaciones conservadoras basadas en el mercado de Wisconsin."
    user_msg = (
        f"Calcula el underwriting financiero para esta propiedad:\n\n{property_data}\n\n"
        f"Estrategia: {strategy}{scout_section}\n\n"
        "Devuelve únicamente el JSON estricto de tu análisis."
    )
    logger.info("Invoking El Matemático...")
    # SMART ESCALATION: Matemático starts with Sonnet, escalates to Opus if complex
    if MODEL_CONFIG_LOADED:
        model = get_model_with_escalation_logging(
            agent_name="matematico",
            prompt=user_msg,
            task_id=f"math_{datetime.now().timestamp()}",
            log_to_airtable=True
        )
    else:
        model = CLAUDE_MODEL
    return _run_subagent_sync(system_prompt, user_msg, model=model)


def _tool_invoke_fact_checker(property_data: str, scout_json: str, matematico_json: str) -> str:
    system_prompt = load_agent_prompt("fact-checker")
    user_msg = (
        f"Audita este deal:\n\nPROPIEDAD:\n{property_data}\n\n"
        f"JSON DE EL SCOUT:\n{scout_json}\n\n"
        f"JSON DE EL MATEMÁTICO:\n{matematico_json}\n\n"
        "Devuelve únicamente el JSON estricto de tu auditoría con el Confidence Score."
    )
    logger.info("Invoking El Fact-Checker...")
    # SMART ESCALATION: Fact-Checker starts with Sonnet, escalates to Opus if complex
    # ⚠️ VALIDATION: Monitor Confidence Scores — must be ≥7.0/10
    if MODEL_CONFIG_LOADED:
        model = get_model_with_escalation_logging(
            agent_name="fact-checker",
            prompt=user_msg,
            task_id=f"check_{datetime.now().timestamp()}",
            log_to_airtable=True
        )
    else:
        model = CLAUDE_MODEL
    return _run_subagent_sync(system_prompt, user_msg, model=model)


def _tool_invoke_social_media(
    task: str,
    platform: str = "Ambas",
    format_type: str = "Post",
    save_to_airtable: bool = False,
    week_number: int = None
) -> str:
    """
    Invoca al Social Media Agent para generar contenido y opcionalmente guardarlo en Airtable.
    El agente tiene acceso a web_fetch para llamar directamente a Airtable y Make.com.
    """
    system_prompt = load_agent_prompt("social_media")

    save_instruction = ""
    if save_to_airtable:
        save_instruction = (
            f"\n\nDespués de generar el contenido, guárdalo en Airtable usando web_fetch:\n"
            f"POST https://api.airtable.com/v0/{SM_AIRTABLE_BASE_ID}/Ideas%20de%20Contenido\n"
            f"Header Authorization: Bearer {SM_AIRTABLE_TOKEN}\n"
            f"Completa todos los campos disponibles. Confirma el record_id al terminar."
        )

    week_instruction = f"\nSemana de contenido: {week_number}" if week_number else ""

    user_msg = (
        f"Tarea: {task}\n"
        f"Plataforma: {platform}\n"
        f"Formato: {format_type}"
        f"{week_instruction}"
        f"{save_instruction}\n\n"
        "Genera el contenido completo siguiendo el formato de salida obligatorio del sistema."
    )

    logger.info(f"Invoking Social Media Agent: {task[:80]}...")
    # SMART ESCALATION: Social Media starts with Sonnet, escalates to Opus on complex/creative briefs
    if MODEL_CONFIG_LOADED:
        model = get_model_with_escalation_logging(
            agent_name="social_media",
            prompt=user_msg,
            task_id=f"sm_{datetime.now().timestamp()}",
            log_to_airtable=True
        )
    else:
        model = CLAUDE_MODEL
    return _run_subagent_sync(system_prompt, user_msg, tools=SCOUT_TOOLS, model=model)


# ─────────────────────────────────────────────
# CLAUDE CODE — Agente de desarrollo del equipo
# ─────────────────────────────────────────────

CLAUDE_API_URL = "http://localhost:5001"
ALEX_SECRET    = os.getenv("ALEX_SECRET", "pinnacle2024ALEXsecret99")


def _tool_invoke_claude_code(task: str, context: str = "") -> str:
    """
    Delega una tarea técnica a Claude Code via el API Server local.
    Claude Code tiene acceso completo al proyecto y memoria compartida.
    Hace polling hasta recibir el resultado (máx 5 minutos).
    """
    if not http_requests:
        return "Error: librería 'requests' no instalada."

    full_prompt = f"{context}\n\n{task}" if context else task
    headers = {"X-Alex-Secret": ALEX_SECRET, "Content-Type": "application/json"}

    # Verificar que el API server esté activo
    try:
        health = http_requests.get(f"{CLAUDE_API_URL}/health", headers=headers, timeout=5)
        if health.status_code != 200:
            return f"❌ Claude Code API Server no disponible (HTTP {health.status_code})."
    except Exception:
        return "❌ Claude Code API Server no responde en localhost:5001."

    # Encolar la tarea
    try:
        resp = http_requests.post(
            f"{CLAUDE_API_URL}/task",
            headers=headers,
            json={"prompt": full_prompt, "chat_id": "internal_alex", "source": "alex_bot"},
            timeout=15
        )
        if resp.status_code != 202:
            return f"❌ Error encolando tarea: {resp.text[:300]}"
        task_id = resp.json().get("task_id")
    except Exception as e:
        return f"❌ Error conectando con Claude Code: {str(e)}"

    logger.info(f"[invoke_claude_code] Tarea encolada: {task_id[:8]}... | {task[:80]}")

    # Polling hasta completar
    start = time.time()
    while time.time() - start < 300:
        time.sleep(5)
        try:
            status_resp = http_requests.get(
                f"{CLAUDE_API_URL}/task/{task_id}",
                headers=headers,
                timeout=10
            )
            data = status_resp.json()
            status = data.get("status", "")
            if status in ("done", "error"):
                response = data.get("response", "Sin respuesta.")
                if status == "error":
                    return f"⚠️ Claude Code reportó error:\n{response}"
                return response
        except Exception:
            pass  # seguir esperando

    return "⏱ Claude Code no completó la tarea en 5 minutos. Revisa el log del servidor."


# ─────────────────────────────────────────────
# BLOTATO — REST API HELPERS
# ─────────────────────────────────────────────

def _blotato_headers() -> dict:
    return {"blotato-api-key": BLOTATO_API_KEY, "Content-Type": "application/json"}


def _blotato_create_visual(template_id: str, prompt: str, inputs: dict, render: bool = True) -> dict:
    """Crea un visual (imagen/carrusel/video) desde un template de Blotato."""
    if not http_requests:
        return {"error": "requests not installed"}
    try:
        resp = http_requests.post(
            f"{BLOTATO_BASE_URL}/videos/from-templates",
            headers=_blotato_headers(),
            json={"templateId": template_id, "prompt": prompt, "inputs": inputs, "render": render},
            timeout=30
        )
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def _blotato_get_visual_status(visual_id: str) -> dict:
    """Obtiene el status de un visual creado con Blotato."""
    if not http_requests:
        return {"error": "requests not installed"}
    try:
        resp = http_requests.get(
            f"{BLOTATO_BASE_URL}/videos/creations/{visual_id}",
            headers=_blotato_headers(),
            timeout=30
        )
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def _blotato_poll_visual(visual_id: str, max_wait: int = 600, interval: int = 30) -> dict:
    """Espera hasta que el visual esté done o falle. Retorna el status final."""
    start = time.time()
    logger.info(f"[Blotato] Polling visual {visual_id} (max {max_wait}s)...")
    while time.time() - start < max_wait:
        time.sleep(interval)
        status = _blotato_get_visual_status(visual_id)
        current = status.get("status", "unknown")
        logger.info(f"[Blotato] {visual_id} → {current}")
        if current == "done":
            return status
        if "failed" in current or "error" in status:
            return status
    return {"status": "timeout", "id": visual_id}


def _blotato_create_post(
    account_id: str,
    platform: str,
    text: str,
    media_urls: list,
    scheduled_time: str,
    page_id: str = None,
    media_type: str = None
) -> dict:
    """Crea y programa un post en FB o IG via Blotato."""
    if not http_requests:
        return {"error": "requests not installed"}
    payload = {
        "post": {"text": text, "mediaUrls": media_urls},
        "target": {"accountId": account_id, "platform": platform},
        "scheduledTime": scheduled_time
    }
    if page_id:
        payload["target"]["pageId"] = page_id
    if media_type:
        payload["post"]["mediaType"] = media_type
    try:
        resp = http_requests.post(
            f"{BLOTATO_BASE_URL}/posts",
            headers=_blotato_headers(),
            json=payload,
            timeout=30
        )
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def _blotato_list_schedules() -> list:
    """Lista los posts programados en Blotato."""
    if not http_requests:
        return []
    try:
        resp = http_requests.get(f"{BLOTATO_BASE_URL}/schedules", headers=_blotato_headers(), timeout=30)
        data = resp.json()
        return data if isinstance(data, list) else data.get("items", data.get("schedules", []))
    except Exception as e:
        logger.warning(f"[Blotato] list_schedules error: {e}")
        return []


def _next_available_slot(existing_schedules: list) -> str:
    """
    Calcula el siguiente slot disponible: Mar/Jue/Sáb 10am o 12pm CST (UTC-6).
    Retorna timestamp ISO8601 en UTC.
    """
    from datetime import timedelta, timezone as tz
    occupied = set()
    for s in existing_schedules:
        st = s.get("scheduledTime") or s.get("scheduled_time") or ""
        if st:
            occupied.add(st[:16])  # "YYYY-MM-DDTHH:MM"

    now = datetime.now(tz.utc)
    candidate = now + timedelta(days=1)
    candidate = candidate.replace(hour=16, minute=0, second=0, microsecond=0)  # 10am CST = 16:00 UTC

    for _ in range(60):  # máximo 60 intentos (~4 semanas)
        weekday = candidate.weekday()  # 0=Lun, 1=Mar, 3=Jue, 5=Sáb
        if weekday in (1, 3, 5):  # Martes, Jueves, Sábado
            for hour_utc in (16, 18):  # 10am CST y 12pm CST
                slot = candidate.replace(hour=hour_utc)
                slot_str = slot.strftime("%Y-%m-%dT%H:%M")
                if slot_str not in occupied:
                    return slot.strftime("%Y-%m-%dT%H:%M:%SZ")
        candidate += timedelta(days=1)

    # fallback: 7 días desde ahora
    fallback = now + timedelta(days=7)
    return fallback.strftime("%Y-%m-%dT%H:%M:%SZ")


# ─────────────────────────────────────────────
# EL CREATIVO — Genera visuals para posts/carruseles
# ─────────────────────────────────────────────

def _tool_invoke_creativo(task: str, record_id: str = None) -> str:
    """
    Dispara El Creativo vía GitHub Actions workflow_dispatch.

    Pipeline real (NO Blotato — regla R10 / CLAUDE.md §1d):
      GHA agents-cron.yml → creativo.mjs → Airtable read → themes.mjs +
      Playwright render → Cloudinary upload → Airtable visual_url update.

    Modos:
      - Sin record_id  → mode=batch  (procesa hasta 3 ideas pendientes, ~3-5 min)
      - Con record_id  → mode=one    (regenera ese visual específico, ~1-2 min).
                         Si la idea ya tiene visual_url, lo sobreescribe (regenerate).
    """
    if not http_requests:
        return "Error: librería 'requests' no instalada."

    record_id = (record_id or "").strip()
    is_regenerate = bool(record_id)
    mode = "one" if is_regenerate else "batch"

    dispatch_inputs = {"agent": "creativo", "mode": mode}
    if is_regenerate:
        dispatch_inputs["record_id"] = record_id

    dispatch_url = f"{BRIDGE_URL.rstrip('/')}/github_dispatch.php"
    payload = {
        "workflow": "agents-cron.yml",
        "ref": "master",
        "inputs": dispatch_inputs,
    }

    try:
        resp = http_requests.post(
            dispatch_url,
            headers={"X-Alex-Secret": ALEX_SECRET, "Content-Type": "application/json"},
            json=payload,
            timeout=20,
        )
    except Exception as e:
        return f"❌ El Creativo: error de red contactando GHA dispatch — {e}"

    if resp.status_code not in (200, 204):
        return f"❌ El Creativo: GHA dispatch rechazado (HTTP {resp.status_code}) — {resp.text[:300]}"

    runs_url = "https://github.com/geocarp24/alex-real-estate-system/actions/workflows/agents-cron.yml"
    if is_regenerate:
        return (
            f"🔄 El Creativo (regenerate) disparado vía GHA.\n"
            f"Target: `{record_id}` — sobreescribe visual_url existente.\n"
            f"Pipeline: Puppeteer + themes.mjs → Cloudinary → Airtable (~1-2 min).\n"
            f"Run en vivo: {runs_url}"
        )
    return (
        f"🚀 El Creativo (batch) disparado vía GHA.\n"
        f"Pipeline: Puppeteer + themes.mjs → Cloudinary → Airtable.\n"
        f"Procesa hasta 3 ideas pendientes en este run (~3-5 min).\n"
        f"Run en vivo: {runs_url}"
    )


# ─────────────────────────────────────────────
# EL DIRECTOR — Genera videos/Reels
# ─────────────────────────────────────────────

def _tool_invoke_director(task: str, record_id: str = None) -> str:
    """
    Dispara El Director v2 vía GitHub Actions workflow_dispatch.

    Pipeline real (faceless reels — NO Blotato):
      GHA agents-cron.yml → director_v2.mjs → Airtable read (Formato=Reel) →
      narrative_B expand → Pexels stock + Nano Banana / Flux Schnell → ffmpeg
      composite (zoompan + crossfade + música) → Cloudinary upload →
      Airtable visual_url update.

    Filtro Airtable: Formato=Reel, Status=Nueva, Visual_Prompt set, visual_url empty,
    Error_Reason empty. Procesa hasta 10 reels por run, ~3-8 min cada uno.
    HeyGen avatar branch (Jorge habla) — pendiente que Jefe consiga API key.
    """
    if not http_requests:
        return "Error: librería 'requests' no instalada."

    record_id = (record_id or "").strip()
    is_one = bool(record_id)

    dispatch_inputs = {"agent": "director_v2", "mode": "batch"}
    if is_one:
        dispatch_inputs["record_id"] = record_id

    dispatch_url = f"{BRIDGE_URL.rstrip('/')}/github_dispatch.php"
    payload = {
        "workflow": "agents-cron.yml",
        "ref": "master",
        "inputs": dispatch_inputs,
    }

    try:
        resp = http_requests.post(
            dispatch_url,
            headers={"X-Alex-Secret": ALEX_SECRET, "Content-Type": "application/json"},
            json=payload,
            timeout=20,
        )
    except Exception as e:
        return f"❌ El Director: error de red contactando GHA dispatch — {e}"

    if resp.status_code not in (200, 204):
        return f"❌ El Director: GHA dispatch rechazado (HTTP {resp.status_code}) — {resp.text[:300]}"

    runs_url = "https://github.com/geocarp24/alex-real-estate-system/actions/workflows/agents-cron.yml"
    if is_one:
        return (
            f"🎬 El Director (regenerate Reel) disparado vía GHA.\n"
            f"Target: `{record_id}` — sobreescribe video existente.\n"
            f"Pipeline: Pexels/Nano-Banana → ffmpeg → Cloudinary → Airtable (~3-5 min).\n"
            f"Run en vivo: {runs_url}"
        )
    return (
        f"🎬 El Director v2 (batch) disparado vía GHA.\n"
        f"Pipeline: faceless reels (Pexels + Nano Banana + ffmpeg + música).\n"
        f"Filtro: Formato=Reel, Status=Nueva, Visual_Prompt set, visual_url empty.\n"
        f"Procesa hasta 10 reels en este run (~3-8 min c/u).\n"
        f"Run en vivo: {runs_url}"
    )


# ─────────────────────────────────────────────
# EL PROGRAMADOR — Publica posts en FB+IG
# ─────────────────────────────────────────────

def _tool_invoke_programador(task: str, record_id: str = None) -> str:
    """
    Orquesta a El Programador:
    1. Lee registros con visual_url listo y sin Blotato_Post_IDs
    2. Calcula el siguiente slot disponible (Mar/Jue/Sáb 10am o 12pm CST)
    3. Publica en FB e IG via Blotato
    4. Actualiza Airtable con los IDs de publicación
    """
    if not http_requests:
        return "Error: librería 'requests' no instalada."

    sm_headers = {"Authorization": f"Bearer {SM_AIRTABLE_TOKEN}", "Content-Type": "application/json"}
    table_id_ideas     = SM_TABLE_IDS["Ideas de Contenido"]
    table_id_pubs      = SM_TABLE_IDS["Publicaciones"]

    if record_id:
        url = f"{SM_AIRTABLE_BASE_URL}/{table_id_ideas}/{record_id}"
        resp = http_requests.get(url, headers=sm_headers, timeout=30).json()
        records = [resp] if "id" in resp else []
    else:
        formula = "AND({visual_url}!='',{Blotato_Post_IDs}='')"
        url = f"{SM_AIRTABLE_BASE_URL}/{table_id_ideas}?filterByFormula={http_requests.utils.quote(formula)}&maxRecords=5"
        resp = http_requests.get(url, headers=sm_headers, timeout=30).json()
        records = resp.get("records", [])

    if not records:
        return "✅ El Programador: No hay posts listos para publicar."

    # Obtener slots ya ocupados en Blotato
    existing_schedules = _blotato_list_schedules()

    results = []
    for record in records:
        rec_id = record.get("id", "")
        fields = record.get("fields", {})
        titulo = fields.get("Título de Idea", rec_id)

        # Validaciones
        visual_url = fields.get("visual_url", "")
        caption_en = fields.get("🇺🇸 Caption EN", "")
        caption_es = fields.get("🇲🇽 Caption ES", "")
        hashtags   = fields.get("Hashtags", "")
        formato    = fields.get("Formato", "Post")
        plataforma = fields.get("Plataforma", "AMBAS")
        semana     = fields.get("Semana", 1)

        if not visual_url:
            results.append(f"⚠️ {titulo}: Sin visual_url, saltando.")
            continue
        if not caption_en:
            results.append(f"⚠️ {titulo}: Sin Caption EN, saltando.")
            continue

        # Construir texto
        text = f"{caption_en}\n\n---\n\n{caption_es}\n\n{hashtags}".strip()

        # Construir mediaUrls
        blotato_vid = fields.get("Blotato_Visual_ID", "")
        if "|||" in blotato_vid:
            urls_part = blotato_vid.split("|||")[1]
            media_urls = [u for u in urls_part.split("|") if u.startswith("http")]
        else:
            media_urls = [visual_url]

        # Calcular slot
        slot_time = _next_available_slot(existing_schedules)
        # Marcar este slot como ocupado para el siguiente post
        existing_schedules.append({"scheduledTime": slot_time})

        # media_type para Reels
        media_type = "reel" if formato.lower() == "reel" else None

        fb_post_id = ""
        ig_post_id = ""

        # Publicar en Facebook
        if plataforma.upper() in ("FB", "AMBAS"):
            fb_result = _blotato_create_post(
                account_id=BLOTATO_FB_ACCOUNT,
                platform="facebook",
                text=text,
                media_urls=media_urls,
                scheduled_time=slot_time,
                page_id=BLOTATO_FB_PAGE_ID,
                media_type=media_type
            )
            fb_post_id = fb_result.get("postSubmissionId", "")
            if not fb_post_id:
                logger.warning(f"[Programador] FB fallo para {titulo}: {fb_result}")

        # Publicar en Instagram
        if plataforma.upper() in ("IG", "AMBAS"):
            ig_result = _blotato_create_post(
                account_id=BLOTATO_IG_ACCOUNT,
                platform="instagram",
                text=text,
                media_urls=media_urls,
                scheduled_time=slot_time,
                media_type=media_type
            )
            ig_post_id = ig_result.get("postSubmissionId", "")
            if not ig_post_id:
                logger.warning(f"[Programador] IG fallo para {titulo}: {ig_result}")

        if not fb_post_id and not ig_post_id:
            results.append(f"❌ {titulo}: Falló en FB e IG — sin IDs de publicación.")
            continue

        post_ids = "|".join(filter(None, [fb_post_id, ig_post_id]))

        # Actualizar Ideas de Contenido
        http_requests.patch(
            f"{SM_AIRTABLE_BASE_URL}/{table_id_ideas}/{rec_id}",
            headers=sm_headers,
            json={"fields": {"Blotato_Post_IDs": post_ids}},
            timeout=30
        )

        # Crear registro en Publicaciones
        from datetime import datetime as dt
        fecha_str = slot_time[:10]
        http_requests.post(
            f"{SM_AIRTABLE_BASE_URL}/{table_id_pubs}",
            headers=sm_headers,
            json={"fields": {
                "Nombre del Post": titulo,
                "Plataforma": plataforma,
                "Formato": formato,
                "Tipo": fields.get("Tipo", "Educativo"),
                "Fecha": fecha_str,
                "Caption EN": caption_en,
                "Caption ES": caption_es,
                "Hashtags": hashtags,
                "Semana": semana,
                "visual_url": visual_url,
                "Blotato_Post_IDs": post_ids
            }},
            timeout=30
        )

        # Convertir a CST para mostrar
        from datetime import timezone as tz, timedelta
        slot_dt = dt.strptime(slot_time, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=tz.utc)
        slot_cst = slot_dt - timedelta(hours=6)
        slot_display = slot_cst.strftime("%a %d %b %H:%M CST")

        results.append(
            f"✅ {titulo}\n"
            f"   FB: {fb_post_id or 'skip'} | IG: {ig_post_id or 'skip'}\n"
            f"   Programado: {slot_display}\n"
            f"   Plataformas: {plataforma}"
        )

    return "\n\n".join(results) if results else "El Programador: Sin resultados."


def _tool_invoke_tracy(address: str, city: str = "", state: str = "", zip_code: str = "") -> str:
    """
    Full Tracy implementation: check dup → Tracy log (pending) → CSV → Tracerfy → poll → update Tracy → write Contacts.
    """
    if not http_requests:
        return json.dumps({"tracy_results": {"status": "failed", "errors": ["librería 'requests' no instalada"]}})

    full_address = ", ".join(filter(None, [address, city, state, zip_code]))
    logger.info(f"Tracy skip tracing: {full_address}")
    tracy_table_id = TABLE_IDS["Tracy"]
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z") if True else ""

    # import timezone locally if not available
    try:
        from datetime import timezone as tz
        now_iso = datetime.now(tz.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    except Exception:
        now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")

    try:
        at_headers = {
            "Authorization": f"Bearer {AIRTABLE_TOKEN}",
            "Content-Type": "application/json",
        }

        # ── PASO 0: Verificar duplicados ──────────────────────────
        formula = f"AND(LOWER({{address}})=LOWER('{address}'),{{status}}='success')"
        dup_resp = http_requests.get(
            f"{AIRTABLE_BASE_URL}/{tracy_table_id}",
            headers=at_headers,
            params={"filterByFormula": formula, "maxRecords": 1},
            timeout=20
        ).json()
        dup_records = dup_resp.get("records", [])
        if dup_records:
            prev = dup_records[0].get("fields", {})
            return json.dumps({
                "tracy_results": {
                    "status": "duplicate",
                    "property_address": full_address,
                    "tracy_record_id": dup_records[0].get("id"),
                    "notes": f"Ya rastreada el {prev.get('fecha_rastreo','?')}. Resultado previo: {prev.get('resultado','?')}",
                    "errors": [], "contacts_found": [], "total_contacts_found": 0, "total_written_to_airtable": 0,
                }
            }, ensure_ascii=False)

        # ── PASO 1: Crear registro pending en Tracy ───────────────
        tracy_fields = {
            "address": address, "fecha_rastreo": now_iso,
            "status": "pending", "notas": "Rastreo iniciado por ALEX (Telegram)",
        }
        if city:     tracy_fields["city"]  = city
        if state:    tracy_fields["state"] = state
        if zip_code: tracy_fields["zip"]   = zip_code

        tracy_create = http_requests.post(
            f"{AIRTABLE_BASE_URL}/{tracy_table_id}",
            headers=at_headers, json={"fields": tracy_fields}, timeout=20
        ).json()
        tracy_record_id = tracy_create.get("id")
        if not tracy_record_id:
            logger.warning(f"Tracy: no se pudo crear registro pending: {tracy_create}")

        # ── PASO 2+3: CSV + POST to Tracerfy ─────────────────────
        csv_content = "address,city,state,zip,first_name,last_name,mail_address,mail_city,mail_state,mail_zip\n"
        csv_content += f'"{address}","{city}","{state}","{zip_code}","","","","","",""'

        tracerfy_headers = {"Authorization": f"Bearer {TRACERFY_API_KEY}"}
        files = {"csv_file": ("tracy_input.csv", csv_content.encode("utf-8"), "text/csv")}
        data  = {
            "address_column":      "address",
            "city_column":         "city",
            "state_column":        "state",
            "zip_column":          "zip",
            "first_name_column":   "first_name",
            "last_name_column":    "last_name",
            "mail_address_column": "mail_address",
            "mail_city_column":    "mail_city",
            "mail_state_column":   "mail_state",
            "mailing_zip_column":  "mail_zip",
            "trace_type":          "advanced",
        }

        resp = http_requests.post(
            "https://tracerfy.com/v1/api/trace/",
            headers=tracerfy_headers,
            files=files,
            data=data,
            timeout=30
        )
        trace_data = resp.json()

        if "queue_id" not in trace_data:
            error_msg = f"Tracerfy response sin queue_id: {trace_data}"
            if tracy_record_id:
                http_requests.patch(
                    f"{AIRTABLE_BASE_URL}/{tracy_table_id}/{tracy_record_id}",
                    headers=at_headers,
                    json={"fields": {"status": "error", "resultado": error_msg}},
                    timeout=20
                )
            return json.dumps({
                "tracy_results": {
                    "status": "failed", "property_address": full_address,
                    "tracy_record_id": tracy_record_id,
                    "errors": [error_msg]
                }
            })

        queue_id = trace_data["queue_id"]
        logger.info(f"Tracy queue_id: {queue_id} — polling...")

        # Poll until completed (max 10 attempts × 15s = 2.5 min)
        result_data = None
        for attempt in range(10):
            time.sleep(15)
            poll = http_requests.get(
                f"https://tracerfy.com/v1/api/queue/{queue_id}",
                headers=tracerfy_headers,
                timeout=30
            )
            poll_data = poll.json()
            # El endpoint devuelve array cuando está listo
            if isinstance(poll_data, list):
                logger.info(f"Tracy poll attempt {attempt+1}: completed — {len(poll_data)} record(s)")
                for i, rec in enumerate(poll_data):
                    keys = list(rec.keys()) if isinstance(rec, dict) else str(type(rec))
                    logger.info(f"Tracy record {i} keys: {keys}")
                    logger.info(f"Tracy record {i} preview: {json.dumps(rec, ensure_ascii=False)[:500]}")
                result_data = {"status": "completed", "records": poll_data}
                break
            logger.info(f"Tracy poll attempt {attempt+1}: status={poll_data.get('status')}")
            if poll_data.get("status") not in ("pending", "processing", None):
                result_data = poll_data
                break

        if not result_data:
            if tracy_record_id:
                http_requests.patch(
                    f"{AIRTABLE_BASE_URL}/{tracy_table_id}/{tracy_record_id}",
                    headers=at_headers,
                    json={"fields": {"status": "error", "resultado": "Timeout — 10 intentos sin respuesta"}},
                    timeout=20
                )
            return json.dumps({
                "tracy_results": {
                    "status": "timeout",
                    "queue_id": queue_id,
                    "property_address": full_address,
                    "tracy_record_id": tracy_record_id,
                    "errors": ["Tracerfy timeout after 2.5 minutes"]
                }
            })

        # Extract contacts
        contacts = []
        records = result_data.get("records", result_data.get("results", []))
        if isinstance(records, list):
            for record in records:
                owner_name = (
                    record.get("name") or
                    f"{record.get('first_name', '')} {record.get('last_name', '')}".strip()
                )
                phones = [
                    record.get(k) for k in [
                        "primary_phone", "mobile_1", "mobile_2", "mobile_3",
                        "mobile_4", "mobile_5", "landline_1", "landline_2", "landline_3"
                    ] if record.get(k)
                ]
                emails = [
                    record.get(k) for k in ["email_1", "email_2", "email_3", "email_4", "email_5"]
                    if record.get(k)
                ]
                if owner_name:
                    contacts.append({
                        "name":         owner_name,
                        "phone":        phones[0] if phones else None,
                        "phone_type":   record.get("primary_phone_type", ""),
                        "extra_phones": phones[1:],
                        "email":        emails[0] if emails else None,
                        "extra_emails": emails[1:],
                        "address":      full_address,
                        "mail_address": record.get("mail_address", ""),
                        "mail_city":    record.get("mail_city", ""),
                        "mail_state":   record.get("mail_state", ""),
                        "mail_zip":     record.get("mail_zip", ""),
                        "tracerfy_id":  record.get("id"),
                        "role":         "Owner",
                    })

                for relative in record.get("relatives", record.get("associated_people", [])):
                    rel_name = (
                        relative.get("name") or
                        f"{relative.get('first_name', '')} {relative.get('last_name', '')}".strip()
                    )
                    rel_phones = [
                        relative.get(k) for k in ["phone", "mobile_1", "primary_phone"] if relative.get(k)
                    ]
                    rel_emails = [
                        relative.get(k) for k in ["email", "email_1"] if relative.get(k)
                    ]
                    if rel_name:
                        contacts.append({
                            "name": rel_name,
                            "phone": rel_phones[0] if rel_phones else None,
                            "extra_phones": [],
                            "email": rel_emails[0] if rel_emails else None,
                            "extra_emails": [],
                            "role": "Relative"
                        })

        # Fallback: instant lookup si queue no devolvió contactos
        if not contacts:
            logger.info("Tracy queue sin contactos — intentando instant lookup como fallback...")
            try:
                lookup_payload = {
                    "address": address, "city": city, "state": state, "find_owner": True
                }
                if zip_code:
                    lookup_payload["zip"] = zip_code
                lookup_resp = http_requests.post(
                    "https://tracerfy.com/v1/api/trace/lookup/",
                    headers={"Authorization": f"Bearer {TRACERFY_API_KEY}", "Content-Type": "application/json"},
                    json=lookup_payload,
                    timeout=30
                )
                lookup_data = lookup_resp.json()
                logger.info(f"Tracy instant lookup response: {json.dumps(lookup_data, ensure_ascii=False)[:500]}")
                persons = lookup_data.get("persons", []) if isinstance(lookup_data, dict) else []
                if persons:
                    p = persons[0]
                    owner_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
                    phones = [ph.get("number") for ph in p.get("phones", []) if ph.get("number")]
                    phone_types = [ph.get("type", "") for ph in p.get("phones", [])]
                    emails = [em.get("address") for em in p.get("emails", []) if em.get("address")]
                    if owner_name:
                        contacts.append({
                            "name": owner_name,
                            "phone": phones[0] if phones else None,
                            "phone_type": phone_types[0] if phone_types else "",
                            "extra_phones": phones[1:],
                            "email": emails[0] if emails else None,
                            "extra_emails": emails[1:],
                            "address": full_address,
                            "mail_address": p.get("mail_address", ""),
                            "mail_city": p.get("mail_city", ""),
                            "mail_state": p.get("mail_state", ""),
                            "mail_zip": p.get("mail_zip", ""),
                            "tracerfy_id": p.get("id"),
                            "role": "Owner",
                        })
                        logger.info(f"Tracy instant lookup encontró: {owner_name}")
            except Exception as e:
                logger.warning(f"Tracy instant lookup error: {e}")

        def _to_e164_int(phone_str):
            if not phone_str: return None
            digits = "".join(c for c in str(phone_str) if c.isdigit())
            if not digits: return None
            if len(digits) == 10:   digits = "1" + digits
            elif len(digits) == 11 and digits.startswith("1"): pass
            else: return None
            return int(digits)

        # Write to Airtable
        airtable_results = []
        for contact in contacts:
            fields = {
                "Full Name":    contact["name"],
                "Category":     "Lead",
                "Stage":        "To Be Contacted",
                "Lead Source":  "Skip Trace - Tracy",
                "Owner Address": full_address,
            }
            # Teléfonos E.164 como entero
            all_phones = [contact.get("phone")] + contact.get("extra_phones", [])
            for key, ph in zip(["Phone1","Phone2","Phone3","Phone4"], all_phones):
                val = _to_e164_int(ph)
                if val: fields[key] = val
            if contact.get("phone_type"):
                fields["Phone1 Type"] = contact["phone_type"]
            # Emails
            all_emails = [contact.get("email")] + contact.get("extra_emails", [])
            for key, em in zip(["Email1","Email2","Email3"], all_emails):
                if em: fields[key] = em
            # Dirección postal
            if contact.get("mail_address"): fields["Mail Address"] = contact["mail_address"]
            if contact.get("mail_city"):    fields["Mail City"]    = contact["mail_city"]
            if contact.get("mail_state"):   fields["Mail State"]   = contact["mail_state"]
            if contact.get("mail_zip"):     fields["Mail Zip"]     = contact["mail_zip"]
            if contact.get("tracerfy_id"):  fields["Tracerfy ID"]  = int(contact["tracerfy_id"])

            at_result = _tool_airtable_create("Contacts", fields)
            try:
                at_data = json.loads(at_result)
            except Exception:
                at_data = {}

            airtable_results.append({
                "name":              contact["name"],
                "phone":             contact.get("phone"),
                "email":             contact.get("email"),
                "role":              contact["role"],
                "airtable_record_id": at_data.get("record_id", ""),
                "airtable_status":   "written" if at_data.get("record_id") else "failed"
            })

        written = sum(1 for r in airtable_results if r["airtable_status"] == "written")
        summary_names = ", ".join(
            f"{r['name']} ({r.get('phone') or 'sin tel'})"
            for r in airtable_results if r["airtable_status"] == "written"
        )
        resultado_str = f"{written} contacto(s): {summary_names}" if written else "Sin contactos escritos"
        notas_str = f"Owner + {sum(1 for c in airtable_results if c.get('role')=='Relative')} relative(s). Escritos en Contacts."

        # ── PASO 5: Actualizar Tracy con resultado ────────────────
        if tracy_record_id:
            http_requests.patch(
                f"{AIRTABLE_BASE_URL}/{tracy_table_id}/{tracy_record_id}",
                headers=at_headers,
                json={"fields": {"status": "success", "resultado": resultado_str, "notas": notas_str}},
                timeout=20
            )
            # el_chismoso.php solo es usado por el_polling.php (Flujo A).
            # El bot (Flujo B) escribe Contacts directamente — no llamar al webhook
            # para evitar sobreescritura con campos vacíos del registro Tracy.

        return json.dumps({
            "tracy_results": {
                "property_address":          full_address,
                "trace_date":                datetime.now().strftime("%Y-%m-%d"),
                "queue_id":                  queue_id,
                "tracy_record_id":           tracy_record_id,
                "status":                    "completed",
                "contacts_found":            airtable_results,
                "total_contacts_found":      len(airtable_results),
                "total_written_to_airtable": written,
                "errors":                    [],
                "notes":                     notas_str,
            }
        }, ensure_ascii=False)

    except Exception as e:
        logger.error(f"Tracy error: {e}")
        return json.dumps({
            "tracy_results": {
                "status": "failed",
                "property_address": full_address,
                "errors": [str(e)]
            }
        })


# ─────────────────────────────────────────────
# ASYNC TOOL DISPATCHER
# ─────────────────────────────────────────────

async def _execute_tool(tool_name: str, tool_input: dict) -> str:
    loop = asyncio.get_event_loop()

    if tool_name == "invoke_scout":
        return await loop.run_in_executor(None, lambda: _tool_invoke_scout(
            tool_input.get("property_data", ""),
            tool_input.get("strategy", "Fix & Flip")
        ))
    elif tool_name == "invoke_matematico":
        return await loop.run_in_executor(None, lambda: _tool_invoke_matematico(
            tool_input.get("property_data", ""),
            tool_input.get("strategy", "Fix & Flip"),
            tool_input.get("scout_json", "")
        ))
    elif tool_name == "invoke_fact_checker":
        return await loop.run_in_executor(None, lambda: _tool_invoke_fact_checker(
            tool_input.get("property_data", ""),
            tool_input.get("scout_json", ""),
            tool_input.get("matematico_json", "")
        ))
    elif tool_name == "invoke_tracy":
        return await loop.run_in_executor(None, lambda: _tool_invoke_tracy(
            tool_input.get("address", ""),
            tool_input.get("city", ""),
            tool_input.get("state", ""),
            tool_input.get("zip_code", "")
        ))
    elif tool_name == "invoke_social_media":
        return await loop.run_in_executor(None, lambda: _tool_invoke_social_media(
            tool_input.get("task", ""),
            tool_input.get("platform", "Ambas"),
            tool_input.get("format_type", "Post"),
            tool_input.get("save_to_airtable", False),
            tool_input.get("week_number")
        ))
    elif tool_name == "invoke_claude_code":
        return await loop.run_in_executor(None, lambda: _tool_invoke_claude_code(
            tool_input.get("task", ""),
            tool_input.get("context", "")
        ))
    elif tool_name == "invoke_creativo":
        return await loop.run_in_executor(None, lambda: _tool_invoke_creativo(
            tool_input.get("task", ""),
            tool_input.get("record_id")
        ))
    elif tool_name == "invoke_director":
        return await loop.run_in_executor(None, lambda: _tool_invoke_director(
            tool_input.get("task", ""),
            tool_input.get("record_id")
        ))
    elif tool_name == "invoke_programador":
        return await loop.run_in_executor(None, lambda: _tool_invoke_programador(
            tool_input.get("task", ""),
            tool_input.get("record_id")
        ))
    elif tool_name == "airtable_list":
        return await loop.run_in_executor(None, lambda: _tool_airtable_list(
            tool_input.get("table", ""),
            tool_input.get("filter_formula"),
            tool_input.get("max_records", 20)
        ))
    elif tool_name == "airtable_create":
        return await loop.run_in_executor(None, lambda: _tool_airtable_create(
            tool_input.get("table", ""),
            tool_input.get("fields", {})
        ))
    elif tool_name == "airtable_update":
        return await loop.run_in_executor(None, lambda: _tool_airtable_update(
            tool_input.get("table", ""),
            tool_input.get("record_id", ""),
            tool_input.get("fields", {})
        ))
    elif tool_name == "airtable_sm_list":
        return await loop.run_in_executor(None, lambda: _tool_airtable_sm_list(
            tool_input.get("table", ""),
            tool_input.get("filter_formula"),
            tool_input.get("max_records", 20)
        ))
    elif tool_name == "airtable_sm_create":
        return await loop.run_in_executor(None, lambda: _tool_airtable_sm_create(
            tool_input.get("table", ""),
            tool_input.get("fields", {})
        ))
    elif tool_name == "airtable_sm_update":
        return await loop.run_in_executor(None, lambda: _tool_airtable_sm_update(
            tool_input.get("table", ""),
            tool_input.get("record_id", ""),
            tool_input.get("fields", {})
        ))
    elif tool_name == "read_memoria":
        return _tool_read_memoria()
    elif tool_name == "write_memoria":
        return _tool_write_memoria(tool_input.get("content", ""))
    elif tool_name == "web_fetch":
        return await loop.run_in_executor(None, lambda: _tool_web_fetch(
            tool_input.get("url", ""),
            tool_input.get("purpose", "")
        ))
    else:
        return f"Tool '{tool_name}' not implemented."


# ─────────────────────────────────────────────
# GESTIÓN DE MEMORIA PERSISTENTE
# ─────────────────────────────────────────────

def session_file(user_id: int) -> Path:
    return SESSIONS_DIR / f"user_{user_id}.json"


def load_history(user_id: int) -> list:
    f = session_file(user_id)
    if f.exists():
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            return data.get("messages", [])
        except Exception:
            return []
    return []


def save_history(user_id: int, messages: list):
    f = session_file(user_id)
    f.write_text(
        json.dumps({
            "user_id": user_id,
            "messages": messages,
            "updated": datetime.now().isoformat()
        }, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def read_telegram_memory() -> str:
    # Intenta bridge primero
    bridge_content = _bridge_read("telegram_bot/telegram_memory.md")
    if bridge_content:
        return bridge_content
    # Fallback: archivo local
    if TELEGRAM_MEM.exists():
        return TELEGRAM_MEM.read_text(encoding="utf-8")
    return ""


def write_telegram_memory(content: str):
    TELEGRAM_MEM.write_text(content, encoding="utf-8")
    date_str = datetime.now().strftime("%Y-%m-%d")
    _bridge_write("telegram_bot/telegram_memory.md", content, f"ALEX telegram memory — {date_str}")


def append_telegram_memory(entry: str):
    existing = read_telegram_memory()
    updated = existing + "\n\n" + entry if existing else entry
    write_telegram_memory(updated)


def append_memoria_alex(entry: str):
    existing = _tool_read_memoria()
    updated = existing + "\n\n" + entry if existing.strip() else entry
    MEMORIA_ALEX.write_text(updated, encoding="utf-8")
    date_str = datetime.now().strftime("%Y-%m-%d")
    _bridge_write("memoria_ALex.md", updated, f"ALEX memoria update — {date_str}")


def load_shared_conv() -> list:
    """Lee el historial compartido desde archivo local."""
    if SHARED_CONV.exists():
        try:
            data = json.loads(SHARED_CONV.read_text(encoding="utf-8"))
            return data.get("messages", [])
        except Exception:
            return []
    return []


def save_shared_conv(messages: list):
    """Guarda el historial compartido, manteniendo solo los últimos SHARED_CONV_MAX mensajes.

    Dual-write: local file (always) + GitHub via Hostinger bridge (best-effort, throttled).
    Without the GitHub mirror, Claude Code sessions see a stale copy frozen at the last
    git pull — breaking cross-channel continuity. Throttled to 1 push/min to avoid
    hammering the bridge during conversation bursts.
    """
    trimmed = messages[-SHARED_CONV_MAX:]
    payload = json.dumps({
        "messages": trimmed,
        "updated": datetime.now().isoformat()
    }, ensure_ascii=False, indent=2)

    # 1. Write local file (canonical for the bot).
    SHARED_CONV.write_text(payload, encoding="utf-8")

    # 2. Push to GitHub via Hostinger bridge (best-effort; never blocks the bot).
    global _LAST_SHARED_CONV_PUSH
    try:
        now_ts = time.time()
        last_push = globals().get("_LAST_SHARED_CONV_PUSH", 0)
        if now_ts - last_push < 60:
            return  # throttle to 1 push/min
        bridge_url = os.getenv("BRIDGE_URL", "https://pinnaclegroupwi.com/agents")
        secret = os.getenv("ALEX_SECRET", ALEX_SECRET if "ALEX_SECRET" in globals() else "")
        if not secret:
            return
        requests.post(
            f"{bridge_url.rstrip('/')}/github_write.php",
            headers={"X-Alex-Secret": secret, "Content-Type": "application/json"},
            json={
                "repo": "alex-real-estate-system",
                "file": "agents/shared_conversation.json",
                "content": payload,
                "message": f"bot: shared_conversation update {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            },
            timeout=8,
        )
        globals()["_LAST_SHARED_CONV_PUSH"] = now_ts
    except Exception:
        # Silent failure — bot stability over GitHub mirror.
        pass


def append_shared_conv(role: str, content: str, channel: str = "telegram"):
    """Añade un mensaje al historial compartido."""
    messages = load_shared_conv()
    messages.append({
        "role": role,
        "content": content,
        "channel": channel,
        "timestamp": datetime.now().isoformat()
    })
    save_shared_conv(messages)


def format_shared_conv_for_context(max_messages: int = 20) -> str:
    """Formatea el historial compartido como texto para inyectar como contexto."""
    messages = load_shared_conv()
    if not messages:
        return ""
    recent = messages[-max_messages:]
    lines = ["--- Conversación reciente (historial compartido) ---"]
    for m in recent:
        channel_tag = f"[{m.get('channel','?').upper()}]"
        role_tag = "Jorge" if m["role"] == "user" else "ALEX"
        ts = m.get("timestamp", "")[:16].replace("T", " ")
        content = m["content"]
        if isinstance(content, list):
            content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
        lines.append(f"{ts} {channel_tag} {role_tag}: {content[:500]}")
    lines.append("--- Fin del historial compartido ---")
    return "\n".join(lines)


def send_security_alert(level: str, description: str, solutions: str = "Revisar logs del sistema."):
    """Envía alerta de seguridad al Jefe vía Telegram Bot API directamente."""
    import subprocess
    try:
        subprocess.run(
            ["bash", str(ALERT_SCRIPT), level, description, solutions],
            timeout=15, check=False
        )
        logger.warning(f"[SECURITY ALERT] {level}: {description}")
    except Exception as e:
        logger.error(f"[SECURITY ALERT] No se pudo enviar alerta: {e}")


def read_cola_mensajes() -> str:
    if COLA_MENSAJES.exists():
        return COLA_MENSAJES.read_text(encoding="utf-8")
    return ""


def write_cola_mensajes(entry: str):
    """Añade una entrada al canal inter-agente."""
    existing = read_cola_mensajes()
    updated = existing + "\n" + entry if existing.strip() else entry
    COLA_MENSAJES.write_text(updated, encoding="utf-8")


# ─────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────

def build_system_prompt() -> str:
    base = CLAUDE_MD.read_text(encoding="utf-8") if CLAUDE_MD.exists() else ""

    # Protocolo de seguridad
    protocolo = ""
    if PROTOCOLO_SEG.exists():
        protocolo = f"\n\n---\n## PROTOCOLO DE SEGURIDAD ACTIVO\n{PROTOCOLO_SEG.read_text(encoding='utf-8')}"

    # Cola de mensajes inter-agente
    cola = read_cola_mensajes()
    cola_section = ""
    if cola and cola.strip():
        cola_section = f"\n\n---\n## COLA DE MENSAJES INTER-AGENTE (cola_mensajes.md)\n{cola}"

    memoria_alex = ""
    if MEMORIA_ALEX.exists():
        memoria_alex = f"\n\n---\n## MEMORIA OPERACIONAL (memoria_ALex.md)\n{MEMORIA_ALEX.read_text(encoding='utf-8')}"

    telegram_mem = read_telegram_memory()
    memoria_telegram = ""
    if telegram_mem:
        memoria_telegram = f"\n\n---\n## MEMORIA DE CONVERSACIONES PREVIAS (telegram_memory.md)\n{telegram_mem}"

    telegram_note = """
---
## CONTEXTO DE OPERACIÓN: TELEGRAM

Estás operando a través de Telegram con CAPACIDADES COMPLETAS — exactamente igual que en Claude Code.

### Herramientas disponibles:
- **invoke_scout** — Invoca a El Scout para investigar mercados
- **invoke_matematico** — Invoca a El Matemático para underwriting financiero
- **invoke_fact_checker** — Invoca a El Fact-Checker para auditoría del deal
- **invoke_tracy** — Invoca a Tracy para skip tracing y escritura en Airtable
- **airtable_list / airtable_create / airtable_update** — Lectura y escritura directa en Airtable
- **read_memoria / write_memoria** — Leer y actualizar la memoria operacional
- **web_fetch** — Obtener datos en tiempo real de URLs

### Flujo obligatorio para análisis de deals:
1. Lee memoria (read_memoria) → 2. Lanza Scout y Matemático → 3. Lanza Fact-Checker → 4. Consolida reporte → 5. Escribe en memoria

### Instrucciones de comunicación:
- Responde siempre en español a menos que el Jefe escriba en inglés.
- Envía mensajes de progreso MIENTRAS trabajan los sub-agentes (el bot los muestra automáticamente).
- Sé conciso pero completo. Usa emojis con moderación (✅ ❌ 🏠 💰 📊).
- IMPORTANTE: Tienes acceso completo a la memoria — úsala para dar continuidad entre sesiones de Telegram y Claude Code.
"""
    return base + protocolo + cola_section + telegram_note + memoria_alex + memoria_telegram


# ─────────────────────────────────────────────
# ESTADO GLOBAL
# ─────────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
conversation_history: dict[int, list] = {}
whisper_model = None


# ─────────────────────────────────────────────
# WHISPER (lazy load)
# ─────────────────────────────────────────────

def _load_whisper():
    global whisper_model
    if whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            logger.info("Cargando modelo Whisper...")
            whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
            logger.info("Whisper listo.")
        except ImportError:
            logger.error("faster-whisper no instalado.")
    return whisper_model


def _transcribe_sync(file_path: str) -> str:
    model = _load_whisper()
    if model is None:
        return "[Error: faster-whisper no instalado]"
    segments, _ = model.transcribe(file_path, beam_size=5)
    return " ".join(seg.text.strip() for seg in segments)


async def transcribe(file_path: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(_transcribe_sync, file_path))


# ─────────────────────────────────────────────
# CLAUDE API — AGENTIC LOOP CON TOOL USE
# ─────────────────────────────────────────────

def get_history(user_id: int) -> list:
    if user_id not in conversation_history:
        conversation_history[user_id] = load_history(user_id)
    return conversation_history[user_id]


def _sanitize_history(messages: list) -> list:
    """Converts old image blocks to text to avoid API context errors."""
    result = []
    for i, msg in enumerate(messages):
        is_last_user = (i == len(messages) - 1 and msg["role"] == "user")
        content = msg["content"]
        if isinstance(content, list) and not is_last_user:
            text_parts = []
            for block in content:
                if isinstance(block, dict):
                    if block.get("type") == "text":
                        text_parts.append(block["text"])
                    elif block.get("type") == "image":
                        text_parts.append("[imagen enviada previamente]")
            result.append({"role": msg["role"], "content": " ".join(text_parts) or "[mensaje]"})
        else:
            result.append(msg)
    return result


def _extract_user_text(content) -> str:
    """Extrae texto plano de un user content (str o list de bloques)."""
    if isinstance(content, str):
        return content
    parts = []
    for block in content or []:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return " ".join(parts)


def _filter_tools_for_message(tools: list, user_text: str) -> list:
    """
    Token-frugal gate: oculta invoke_claude_code del modelo a menos que el
    mensaje del usuario contenga keywords técnicos (CLAUDE_CODE_TRIGGERS).
    Evita invocaciones accidentales a Opus 4.7 en consultas conversacionales.
    """
    if should_delegate_to_claude_code(user_text):
        return tools
    return [t for t in tools if t.get("name") != "invoke_claude_code"]


async def ask_claude(user_id: int, content: list, progress_callback=None) -> str:
    """
    Main Claude interaction with full agentic tool use loop.
    ALEX can invoke sub-agents, Airtable, memory, and web_fetch.
    """
    history = get_history(user_id)
    history.append({"role": "user", "content": content})

    if len(history) > MAX_HISTORY:
        history = history[-MAX_HISTORY:]
        conversation_history[user_id] = history

    try:
        system_prompt = build_system_prompt()
        loop = asyncio.get_event_loop()

        # in-flight messages (includes tool_use/tool_result blocks, not stored in history)
        safe_messages = _sanitize_history(history)

        # Token-frugal gate: solo exponer invoke_claude_code si hay triggers técnicos.
        user_text = _extract_user_text(content)
        effective_tools = _filter_tools_for_message(TOOLS, user_text)
        if len(effective_tools) < len(TOOLS):
            logger.info(f"[token-gate] invoke_claude_code hidden for user {user_id} (no tech triggers in '{user_text[:60]}')")

        max_iterations = 20

        for iteration in range(max_iterations):
            def _call():
                return client.messages.create(
                    model=CLAUDE_MODEL,
                    max_tokens=4096,
                    system=system_prompt,
                    messages=safe_messages,
                    tools=effective_tools
                )

            response = await loop.run_in_executor(None, _call)

            if response.stop_reason == "end_turn":
                assistant_text = ""
                for block in response.content:
                    if hasattr(block, "text"):
                        assistant_text += block.text

                # Store only clean text in persistent history
                history.append({"role": "assistant", "content": assistant_text})
                conversation_history[user_id] = history
                save_history(user_id, history)
                # Sync al historial compartido (espejo con Claude Code)
                if history and history[-2]["role"] == "user":
                    user_content = history[-2]["content"]
                    if isinstance(user_content, list):
                        user_text = " ".join(b.get("text","") for b in user_content if isinstance(b, dict) and b.get("type") == "text")
                    else:
                        user_text = str(user_content)
                    append_shared_conv("user", user_text, "telegram")
                append_shared_conv("assistant", assistant_text, "telegram")
                return assistant_text

            elif response.stop_reason == "tool_use":
                # Add assistant response (with tool_use blocks) to in-flight messages
                safe_messages.append({"role": "assistant", "content": response.content})

                tool_results = []
                for block in response.content:
                    if hasattr(block, "type") and block.type == "tool_use":
                        # Send progress notification to Telegram
                        if progress_callback:
                            progress_msg = PROGRESS_MESSAGES.get(block.name, f"⚙️ Ejecutando {block.name}...")
                            try:
                                await progress_callback(progress_msg)
                            except Exception:
                                pass

                        logger.info(f"Tool call: {block.name} | Input: {str(block.input)[:120]}")
                        result = await _execute_tool(block.name, block.input)
                        logger.info(f"Tool result: {block.name} → {str(result)[:120]}")

                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result
                        })

                safe_messages.append({"role": "user", "content": tool_results})

            else:
                # max_tokens or unexpected stop
                break

        return "⚠️ ALEX alcanzó el límite de iteraciones. Intenta con una solicitud más específica."

    except Exception as e:
        logger.error(f"Error Claude API: {e}", exc_info=True)
        # Remove the user message on error to keep history clean
        if history and history[-1]["role"] == "user":
            history.pop()
        return f"❌ Error al conectar con ALEX: {str(e)}"


# ─────────────────────────────────────────────
# MEMORY SUMMARY HELPERS
# ─────────────────────────────────────────────

async def generate_memory_summary(user_id: int) -> str:
    history = get_history(user_id)
    if len(history) < 4:
        return ""

    summary_prompt = """Basándote en esta conversación, genera un resumen CONCISO para la memoria persistente de ALEX.

Incluye SOLO lo que sea relevante para futuras conversaciones:
- Propiedades o zonas discutidas (dirección, precio, estrategia, veredicto)
- Decisiones tomadas o deals en progreso
- Preferencias o instrucciones especiales del Jefe
- Contactos encontrados o acciones pendientes
- Cualquier contexto importante

Formato: fecha actual + puntos concisos. Máximo 200 palabras. Sin encabezados innecesarios."""

    try:
        loop = asyncio.get_event_loop()
        text_messages = []
        for msg in history[-30:]:
            content = msg["content"]
            if isinstance(content, str):
                text_messages.append(msg)
            elif isinstance(content, list):
                texts = [b["text"] for b in content if isinstance(b, dict) and b.get("type") == "text"]
                if texts:
                    text_messages.append({"role": msg["role"], "content": " ".join(texts)})

        def _call():
            return client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=400,
                messages=text_messages + [{"role": "user", "content": summary_prompt}]
            )

        response = await loop.run_in_executor(None, _call)
        return response.content[0].text
    except Exception as e:
        logger.error(f"Error generando resumen: {e}")
        return ""


async def generate_deal_notes(user_id: int) -> str:
    history = get_history(user_id)
    if len(history) < 4:
        return ""

    deal_prompt = """Revisa esta conversación. Si se analizaron propiedades o deals inmobiliarios, extrae las notas clave para el archivo memoria_ALex.md.

Si NO hubo análisis de propiedades o deals, responde exactamente: NO_DEALS

Si SÍ hubo deals, responde SOLO con las notas en este formato:
### [Fecha] — Sesión Telegram
- Propiedad: [dirección/zip si disponible]
- Estrategia: [Fix&Flip/BRRRR/Buy&Hold/etc]
- Veredicto: [Proceed/Discard/Gather More Data]
- Notas clave: [máximo 3 puntos concisos]
- Pendientes: [si aplica]

Máximo 150 palabras. Solo información factual."""

    try:
        loop = asyncio.get_event_loop()
        text_messages = []
        for msg in history[-30:]:
            content = msg["content"]
            if isinstance(content, str):
                text_messages.append(msg)
            elif isinstance(content, list):
                texts = [b["text"] for b in content if isinstance(b, dict) and b.get("type") == "text"]
                if texts:
                    text_messages.append({"role": msg["role"], "content": " ".join(texts)})

        def _call():
            return client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=300,
                messages=text_messages + [{"role": "user", "content": deal_prompt}]
            )

        response = await loop.run_in_executor(None, _call)
        result = response.content[0].text.strip()
        return "" if result == "NO_DEALS" else result
    except Exception as e:
        logger.error(f"Error generando notas de deal: {e}")
        return ""


# ─────────────────────────────────────────────
# HANDLERS — COMANDOS
# ─────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    history = get_history(user_id)
    sessions_count = len([m for m in history if m["role"] == "assistant"])

    await update.message.chat.send_action("typing")

    async def progress(msg):
        await update.message.reply_text(msg, parse_mode="Markdown")

    if sessions_count > 0:
        greeting = (
            f"Retoma la conversación conmigo. Tenemos {sessions_count} intercambios previos. "
            "Salúdame como ALEX, menciona brevemente la memoria de sesiones anteriores y pregunta en qué puedo ayudar hoy."
        )
    else:
        greeting = "Inicia sesión. Salúdame como el Jefe y preséntate como ALEX con todas tus capacidades."

    response = await ask_claude(user_id, [{"type": "text", "text": greeting}], progress_callback=progress)
    await update.message.reply_text(response)


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    await update.message.reply_text("💾 Guardando resumen de sesión en memoria...")

    summary, deal_notes = await asyncio.gather(
        generate_memory_summary(user_id),
        generate_deal_notes(user_id)
    )

    date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    saved = []

    if summary:
        entry = f"### Sesión {date_str}\n{summary}"
        append_telegram_memory(entry)
        saved.append("telegram_memory.md")

    if deal_notes:
        append_memoria_alex(deal_notes)
        saved.append("memoria_ALex.md")

    if saved:
        await update.message.reply_text(f"✅ Memoria guardada en: {', '.join(saved)}\nHistorial limpiado.")
    else:
        await update.message.reply_text("✅ Historial limpiado (sin contenido suficiente para resumir).")

    conversation_history[user_id] = []
    save_history(user_id, [])


async def cmd_permitir(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Autoriza la última acción bloqueada por el sistema de seguridad."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"\n### {timestamp} — ACCION AUTORIZADA POR EL JEFE\nEl Jefe respondio /permitir desde Telegram. Accion previa bloqueada fue autorizada."
    append_telegram_memory(log_entry)
    await update.message.reply_text(
        "✅ *Accion autorizada.* Registrado en memoria.\n\n"
        "Si la operacion quedó pausada, vuelve a solicitarla y se ejecutará sin alarma.",
        parse_mode="Markdown"
    )


async def cmd_bloquear(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Bloquea y registra la última acción alertada."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"\n### {timestamp} — ACCION BLOQUEADA POR EL JEFE\nEl Jefe respondio /bloquear desde Telegram. Accion denegada permanentemente."
    append_telegram_memory(log_entry)
    await update.message.reply_text(
        "🚫 *Accion bloqueada y registrada.* El sistema no ejecutará esa operación.\n\n"
        "Si fue una falsa alarma, usa /permitir y agrega el dominio al protocolo de seguridad.",
        parse_mode="Markdown"
    )


async def cmd_memoria(update: Update, context: ContextTypes.DEFAULT_TYPE):
    mem = read_telegram_memory()
    if mem:
        if len(mem) > 4000:
            mem = mem[:4000] + "\n...[truncado]"
        await update.message.reply_text(f"🧠 *Memoria de ALEX (Telegram):*\n\n{mem}", parse_mode="Markdown")
    else:
        await update.message.reply_text("No hay memoria de sesiones previas aún. Se guarda al usar /reset.")


async def cmd_guardar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    await update.message.reply_text("💾 Guardando resumen en memoria...")

    summary, deal_notes = await asyncio.gather(
        generate_memory_summary(user_id),
        generate_deal_notes(user_id)
    )

    date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    saved = []

    if summary:
        entry = f"### Sesión {date_str}\n{summary}"
        append_telegram_memory(entry)
        saved.append("telegram_memory.md")

    if deal_notes:
        append_memoria_alex(deal_notes)
        saved.append("memoria_ALex.md")

    if saved:
        display = summary or deal_notes
        msg = f"✅ Guardado en: {', '.join(saved)}\n\n_{display}_"
        await update.message.reply_text(msg, parse_mode="Markdown")
    else:
        await update.message.reply_text("No hay suficiente conversación para resumir aún.")


async def cmd_historial(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    history = get_history(user_id)
    count = len(history)
    user_msgs = len([m for m in history if m["role"] == "user"])
    await update.message.reply_text(
        f"📊 *Historial activo:*\n"
        f"- Total mensajes: {count}\n"
        f"- Tus mensajes: {user_msgs}\n"
        f"- Respuestas de ALEX: {count - user_msgs}\n\n"
        f"Usa /guardar para guardar un resumen en memoria.\n"
        f"Usa /reset para guardar y limpiar el historial.",
        parse_mode="Markdown"
    )


async def cmd_capacidades(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 *ALEX — Capacidades en Telegram:*\n\n"
        "🔍 *Sub-agentes:*\n"
        "• El Scout — Investigación de mercado con datos reales\n"
        "• El Matemático — Underwriting financiero completo\n"
        "• El Fact-Checker — Auditoría y Confidence Score\n"
        "• Tracy — Skip tracing + escritura en Airtable\n\n"
        "📋 *Airtable (lectura y escritura):*\n"
        "• Contacts, Leads, Deals, Notes & Activity\n\n"
        "🧠 *Memoria compartida con Claude Code:*\n"
        "• memoria\\_ALex.md (deals y lecciones)\n"
        "• telegram\\_memory.md (sesiones de Telegram)\n\n"
        "📱 *Multimedia:*\n"
        "• Texto, Voz (transcripción automática), Fotos, Videos\n\n"
        "⚡ *Comandos:*\n"
        "/start /reset /guardar /memoria /historial /capacidades",
        parse_mode="Markdown"
    )


# ─────────────────────────────────────────────
# HANDLERS — MENSAJES
# ─────────────────────────────────────────────

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text
    await update.message.chat.send_action("typing")

    async def progress(msg):
        await update.message.reply_text(msg, parse_mode="Markdown")

    response = await ask_claude(user_id, [{"type": "text", "text": text}], progress_callback=progress)
    for i in range(0, len(response), 4000):
        await update.message.reply_text(response[i:i+4000])


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    await update.message.chat.send_action("typing")

    voice_file = await update.message.voice.get_file()
    with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as tmp:
        tmp_path = tmp.name

    await voice_file.download_to_drive(tmp_path)
    await update.message.reply_text("🎤 Transcribiendo...")
    transcript = await transcribe(tmp_path)
    os.unlink(tmp_path)

    if not transcript.strip():
        await update.message.reply_text("❌ No pude transcribir el audio.")
        return

    await update.message.reply_text(f"🎤 _{transcript}_", parse_mode="Markdown")
    await update.message.chat.send_action("typing")

    async def progress(msg):
        await update.message.reply_text(msg, parse_mode="Markdown")

    response = await ask_claude(user_id, [{"type": "text", "text": transcript}], progress_callback=progress)
    for i in range(0, len(response), 4000):
        await update.message.reply_text(response[i:i+4000])


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    caption = update.message.caption or "Analiza esta imagen. Dime qué ves y si es relevante para inversión inmobiliaria."
    await update.message.chat.send_action("typing")

    photo = update.message.photo[-1]
    photo_file = await photo.get_file()
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name

    await photo_file.download_to_drive(tmp_path)
    with open(tmp_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()
    os.unlink(tmp_path)

    async def progress(msg):
        await update.message.reply_text(msg, parse_mode="Markdown")

    content = [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_data}},
        {"type": "text", "text": caption}
    ]
    response = await ask_claude(user_id, content, progress_callback=progress)
    for i in range(0, len(response), 4000):
        await update.message.reply_text(response[i:i+4000])


async def handle_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    caption = update.message.caption or "Analiza este video."
    await update.message.chat.send_action("typing")

    async def progress(msg):
        await update.message.reply_text(msg, parse_mode="Markdown")

    if update.message.video.thumbnail:
        thumb_file = await update.message.video.thumbnail.get_file()
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name
        await thumb_file.download_to_drive(tmp_path)
        with open(tmp_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode()
        os.unlink(tmp_path)
        content = [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_data}},
            {"type": "text", "text": f"[VIDEO — thumbnail] {caption}"}
        ]
    else:
        content = [{"type": "text", "text": f"[VIDEO sin thumbnail] {caption}"}]

    response = await ask_claude(user_id, content, progress_callback=progress)
    for i in range(0, len(response), 4000):
        await update.message.reply_text(response[i:i+4000])


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    file_name = update.message.document.file_name or "documento"
    caption = update.message.caption or f"Recibí el documento: {file_name}"
    await update.message.chat.send_action("typing")

    async def progress(msg):
        await update.message.reply_text(msg, parse_mode="Markdown")

    response = await ask_claude(user_id, [{"type": "text", "text": caption}], progress_callback=progress)
    await update.message.reply_text(response)


async def handle_unknown(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("No reconozco ese tipo de mensaje. Envíame texto, voz, foto o video.")


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

CLAUDE_API_URL    = "http://localhost:5001"
CLAUDE_API_SECRET = os.getenv("ALEX_SECRET", "pinnacle2024ALEXsecret99")

# Palabras clave que activan auto-delegación a Claude Code.
# Estos triggers también determinan si la tool `invoke_claude_code` se incluye
# en la lista de tools disponibles para el modelo en cada turno (gate en
# _filter_tools_for_message). Mensajes sin estos keywords NO podrán llamar
# Claude Code → ahorra tokens de Opus 4.7 en tareas conversacionales.
CLAUDE_CODE_TRIGGERS = [
    "ejecuta", "corre el script", "bash", "shell", "systemctl",
    "git commit", "git push", "git pull", "git merge", "git checkout",
    "crea un branch", "rama nueva", "crea un pr", "crea pr", "pull request",
    "merge", "rebase", "cherry-pick",
    "deploy", "deployar", "despliega",
    "workflow", "github actions", "cron", "trigger workflow",
    "instala", "pip install", "npm install", "yarn add", "apt install",
    "edita el archivo", "modifica el código", "modifica el archivo",
    "actualiza el bot", "agrega al script", "añade al script",
    "crea un archivo", "elimina el archivo", "refactor", "refactoriza",
    "debuggea", "depura", "arregla el error", "traceback", "stack trace",
    "docker", "dockerfile", "docker-compose",
    "reinicia el servicio", "lee el log", "muestra los logs", "tail",
]


def delegate_to_claude_api(prompt: str, chat_id, source: str = "telegram") -> tuple[bool, str]:
    """
    Envía una tarea al Claude API Server via HTTP POST.
    Retorna (éxito, task_id o mensaje de error).
    """
    try:
        r = http_requests.post(
            f"{CLAUDE_API_URL}/task",
            json={"prompt": prompt, "chat_id": str(chat_id), "source": source},
            headers={"X-Alex-Secret": CLAUDE_API_SECRET},
            timeout=10
        )
        if r.status_code == 202:
            data = r.json()
            return True, data.get("task_id", "")
        return False, f"API error {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return False, str(e)


def should_delegate_to_claude_code(text: str) -> bool:
    """
    Auto-detección: devuelve True si el mensaje contiene
    palabras clave que requieren Claude Code CLI.
    """
    text_lower = text.lower()
    return any(trigger in text_lower for trigger in CLAUDE_CODE_TRIGGERS)


async def cmd_claude(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Envía tarea al Claude API Server (HTTP) — respuesta llega directo a Telegram.
    """
    user_id = str(update.effective_user.id)
    if user_id != OWNER_CHAT_ID:
        await update.message.reply_text("⛔ Solo el Jefe puede usar este comando.")
        return

    task = " ".join(context.args) if context.args else ""
    if not task:
        await update.message.reply_text(
            "⚠️ Uso: `/claude <tarea>`\nEjemplo: `/claude muéstrame los leads activos en Airtable`",
            parse_mode="Markdown"
        )
        return

    success, result = delegate_to_claude_api(task, update.effective_chat.id)

    if success:
        await update.message.reply_text(
            f"📨 Tarea enviada a Claude Code.\n"
            f"Te notifico aquí cuando esté lista.\n"
            f"ID: `{result[:8]}...`",
            parse_mode="Markdown"
        )
    else:
        await update.message.reply_text(
            f"⚠️ API no disponible. Reintentando con worker local...\n`{result}`",
            parse_mode="Markdown"
        )
        # Fallback al inbox del worker
        import uuid as _uuid
        task_id = str(_uuid.uuid4())
        inbox_file = PROJECT_DIR / "agents" / "claude_inbox.json"
        try:
            tasks = json.loads(inbox_file.read_text(encoding="utf-8")) if inbox_file.exists() else []
        except Exception:
            tasks = []
        tasks.append({
            "task_id": task_id, "prompt": task,
            "chat_id": update.effective_chat.id,
            "source": "telegram", "status": "pending",
            "created_at": datetime.now().isoformat()
        })
        inbox_file.write_text(json.dumps(tasks, ensure_ascii=False, indent=2), encoding="utf-8")
        await update.message.reply_text(f"📨 Encolado via worker. ID: `{task_id[:8]}...`", parse_mode="Markdown")


GITHUB_QUEUE_REPO = "pinnacle-agent-memory"
GITHUB_QUEUE_FILE = "task_queue.json"


def write_task_to_github(task_description: str, chat_id, source: str = "telegram") -> tuple[bool, str]:
    """
    Escribe una tarea en task_queue.json en GitHub via bridge.
    Retorna (éxito, task_id o mensaje de error).
    """
    if not http_requests:
        return False, "requests no disponible"

    # Leer queue actual
    try:
        r = http_requests.get(
            f"{BRIDGE_URL}/github_bridge.php",
            params={"repo": GITHUB_QUEUE_REPO, "file": GITHUB_QUEUE_FILE},
            headers={"X-Alex-Secret": ALEX_SECRET},
            timeout=15
        )
        tasks = json.loads(r.text) if r.status_code == 200 else []
    except Exception:
        tasks = []

    # Agregar nueva tarea
    task_id = str(__import__("uuid").uuid4())
    tasks.append({
        "task_id":    task_id,
        "task":       task_description,
        "chat_id":    str(chat_id),
        "source":     source,
        "status":     "pendiente",
        "created_at": datetime.now().isoformat()
    })

    # Guardar en GitHub
    try:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M")
        r = http_requests.post(
            f"{BRIDGE_URL}/github_write.php",
            json={
                "repo":    GITHUB_QUEUE_REPO,
                "file":    GITHUB_QUEUE_FILE,
                "content": json.dumps(tasks, ensure_ascii=False, indent=2),
                "message": f"bot: nueva tarea — {ts}"
            },
            headers={"X-Alex-Secret": ALEX_SECRET, "Content-Type": "application/json"},
            timeout=20
        )
        if r.status_code == 200 and r.json().get("success"):
            return True, task_id
        return False, f"Bridge error {r.status_code}"
    except Exception as e:
        return False, str(e)


async def cmd_tarea(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Escribe una tarea en GitHub task_queue.json.
    El GitHub Monitor la detecta y ejecuta automáticamente via Claude Code.
    Resultado llega a Telegram sin que Jorge abra Claude Code.
    """
    user_id = str(update.effective_user.id)
    if user_id != OWNER_CHAT_ID:
        await update.message.reply_text("⛔ Solo el Jefe puede usar este comando.")
        return

    task = " ".join(context.args) if context.args else ""
    if not task:
        await update.message.reply_text(
            "⚠️ Uso: `/tarea <descripción>`\n"
            "Ejemplo: `/tarea analiza el mercado de Milwaukee WI para Fix & Flip`\n\n"
            "El Monitor la ejecuta automáticamente y te avisa aquí.",
            parse_mode="Markdown"
        )
        return

    success, result = await asyncio.to_thread(
        write_task_to_github, task, update.effective_chat.id
    )

    if success:
        await update.message.reply_text(
            f"📋 *Tarea enviada al Monitor GitHub*\n\n"
            f"_{task[:200]}_\n\n"
            f"El Monitor la detectará en los próximos 30 segundos y ejecutará Claude Code.\n"
            f"Te aviso aquí cuando esté lista.\n"
            f"ID: `{result[:8]}...`",
            parse_mode="Markdown"
        )
    else:
        await update.message.reply_text(
            f"⚠️ No se pudo escribir en GitHub: `{result}`\n"
            f"Usa `/claude {task}` como alternativa.",
            parse_mode="Markdown"
        )


# ─────────────────────────────────────────────
# EL SECRETARIO — Comandos de Email y Calendario
# ─────────────────────────────────────────────

def _secretario_import():
    """Importa El Secretario con manejo de error."""
    try:
        import sys
        sys.path.insert(0, str(PROJECT_DIR))
        from secretario.email_monitor import (
            get_ultimos_emails, responder_email_aprobado, procesar_emails
        )
        from secretario.calendar_manager import (
            get_eventos_hoy, get_eventos_semana, crear_cita,
            formatear_agenda_diaria, get_google_service
        )
        return True, {
            "get_ultimos_emails": get_ultimos_emails,
            "responder_email_aprobado": responder_email_aprobado,
            "procesar_emails": procesar_emails,
            "get_eventos_hoy": get_eventos_hoy,
            "get_eventos_semana": get_eventos_semana,
            "crear_cita": crear_cita,
            "formatear_agenda_diaria": formatear_agenda_diaria,
            "get_google_service": get_google_service,
        }
    except Exception as e:
        return False, str(e)


async def cmd_emails(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /emails — Ver últimos emails importantes
    /emails revisar — Forzar revisión ahora
    """
    user_id = str(update.effective_user.id)
    if user_id != OWNER_CHAT_ID:
        await update.message.reply_text("⛔ Solo el Jefe puede usar este comando.")
        return

    ok, mod = _secretario_import()
    if not ok:
        await update.message.reply_text(f"⚠️ El Secretario no disponible: {mod}")
        return

    # Revisar ahora si se pide
    if context.args and context.args[0].lower() in ("revisar", "check", "ahora"):
        await update.message.reply_text("📧 Revisando emails ahora...")
        try:
            await asyncio.to_thread(mod["procesar_emails"])
        except Exception as e:
            await update.message.reply_text(f"⚠️ Error al revisar: {e}")
            return

    # Mostrar últimos emails
    try:
        emails = await asyncio.to_thread(mod["get_ultimos_emails"], 5)
    except Exception as e:
        await update.message.reply_text(f"⚠️ Error leyendo DB: {e}")
        return

    if not emails:
        await update.message.reply_text("📭 No hay emails registrados aún.\n\nUsa `/emails revisar` para revisar ahora.")
        return

    cat_emojis = {"LEAD": "🏠", "URGENTE": "🚨", "RUTINARIO": "📋", "SPAM": "🗑️"}
    lines = ["📧 *ÚLTIMOS EMAILS — deals@pinnaclegroupwi.com*\n"]

    for em in emails:
        cat   = em.get("categoria", "?")
        emoji = cat_emojis.get(cat, "📧")
        resp  = "✅" if em.get("respondido") else "⏳"
        lines.append(
            f"{emoji} `ID:{em['id']}` {resp} *{cat}*\n"
            f"   De: {em.get('remitente','')[:50]}\n"
            f"   Asunto: {em.get('asunto','')[:60]}\n"
            f"   {em.get('resumen','')[:100]}\n"
        )

    lines.append("\nPara responder: `/responder <ID>`")
    lines.append("Para revisar nuevos: `/emails revisar`")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_responder(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /responder <id> — Enviar respuesta sugerida por ALEX
    /responder <id> <mensaje personalizado>
    """
    user_id = str(update.effective_user.id)
    if user_id != OWNER_CHAT_ID:
        await update.message.reply_text("⛔ Solo el Jefe puede usar este comando.")
        return

    if not context.args:
        await update.message.reply_text(
            "⚠️ Uso:\n"
            "`/responder 5` — enviar respuesta sugerida al email ID 5\n"
            "`/responder 5 Tu mensaje aquí` — enviar mensaje personalizado",
            parse_mode="Markdown"
        )
        return

    ok, mod = _secretario_import()
    if not ok:
        await update.message.reply_text(f"⚠️ El Secretario no disponible: {mod}")
        return

    try:
        db_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("⚠️ El ID debe ser un número. Ejemplo: `/responder 5`")
        return

    texto_personalizado = " ".join(context.args[1:]) if len(context.args) > 1 else None

    await update.message.reply_text("📤 Enviando respuesta...")
    try:
        ok_send, msg = await asyncio.to_thread(
            mod["responder_email_aprobado"], db_id, texto_personalizado
        )
    except Exception as e:
        await update.message.reply_text(f"⚠️ Error: {e}")
        return

    if ok_send:
        await update.message.reply_text(f"✅ *Respuesta enviada*\n{msg}", parse_mode="Markdown")
    else:
        await update.message.reply_text(f"❌ *Error al enviar*\n{msg}", parse_mode="Markdown")


async def cmd_buscar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /buscar <pregunta> — Busca en la base de conocimiento de ALEX usando LightRAG
    Busca en: memoria, conversaciones, Contacts, Leads, Deals de Airtable
    """
    user_id = str(update.effective_user.id)
    if user_id != OWNER_CHAT_ID:
        await update.message.reply_text("⛔ Solo el Jefe puede usar este comando.")
        return

    query = " ".join(context.args) if context.args else ""
    if not query:
        await update.message.reply_text(
            "📚 Uso: /buscar <pregunta>\n\n"
            "Ejemplos:\n"
            "• /buscar cuántos leads tenemos en Wisconsin\n"
            "• /buscar propiedades con foreclosure\n"
            "• /buscar último deal analizado"
        )
        return

    await update.message.reply_text(f"🔍 Buscando: *{query}*...", parse_mode="Markdown")

    try:
        result = subprocess.run(
            ["/opt/alex-bot/venv/bin/python3", "/opt/alex-bot/rag/alex_rag.py", "query", query],
            capture_output=True, text=True, timeout=60,
            cwd="/opt/alex-bot"
        )
        answer = result.stdout.strip() or result.stderr.strip() or "Sin resultados."
        # Limitar longitud para Telegram
        if len(answer) > 3500:
            answer = answer[:3500] + "\n\n_[respuesta truncada]_"
        await update.message.reply_text(f"📚 *Resultado:*\n\n{answer}", parse_mode="Markdown")
    except subprocess.TimeoutExpired:
        await update.message.reply_text("⏱ La búsqueda tardó demasiado. Intenta con una pregunta más específica.")
    except Exception as e:
        await update.message.reply_text(f"❌ Error en búsqueda: {str(e)}")


async def cmd_reindexar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /reindexar — Re-indexa toda la base de conocimiento de ALEX en LightRAG
    """
    user_id = str(update.effective_user.id)
    if user_id != OWNER_CHAT_ID:
        await update.message.reply_text("⛔ Solo el Jefe puede usar este comando.")
        return

    await update.message.reply_text("⚙️ Re-indexando base de conocimiento... (puede tomar 1-2 minutos)")

    try:
        result = subprocess.run(
            ["/opt/alex-bot/venv/bin/python3", "/opt/alex-bot/rag/alex_rag.py", "index"],
            capture_output=True, text=True, timeout=180,
            cwd="/opt/alex-bot"
        )
        output = result.stdout.strip()
        lines = [l for l in output.split("\n") if l.startswith("✓") or l.startswith("✅") or "Error" in l]
        summary = "\n".join(lines) or "Completado."
        await update.message.reply_text(f"✅ *Re-indexación completa:*\n\n{summary}", parse_mode="Markdown")
    except subprocess.TimeoutExpired:
        await update.message.reply_text("⏱ La indexación tardó demasiado. Intenta más tarde.")
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")


async def cmd_agenda(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /agenda — Ver agenda de hoy
    /agenda semana — Ver próximos 7 días
    """
    user_id = str(update.effective_user.id)
    if user_id != OWNER_CHAT_ID:
        await update.message.reply_text("⛔ Solo el Jefe puede usar este comando.")
        return

    ok, mod = _secretario_import()
    if not ok:
        await update.message.reply_text(f"⚠️ Calendar no disponible: {mod}")
        return

    modo_semana = context.args and context.args[0].lower() in ("semana", "week", "7d")

    await update.message.reply_text("📅 Consultando agenda...")
    try:
        service = await asyncio.to_thread(mod["get_google_service"])
        if not service:
            await update.message.reply_text(
                "⚠️ Google Calendar no configurado aún.\n\n"
                "Para configurarlo:\n"
                "1. Sigue las instrucciones en el VPS\n"
                "2. Ejecuta: `python3 secretario/calendar_manager.py --setup`",
                parse_mode="Markdown"
            )
            return

        if modo_semana:
            eventos = await asyncio.to_thread(mod["get_eventos_semana"], service)
            titulo  = f"📅 *AGENDA — PRÓXIMOS 7 DÍAS*\n"
        else:
            eventos = await asyncio.to_thread(mod["get_eventos_hoy"], service)
            titulo  = None

        mensaje = mod["formatear_agenda_diaria"](eventos, titulo)
        await update.message.reply_text(mensaje, parse_mode="Markdown")

    except Exception as e:
        await update.message.reply_text(f"⚠️ Error consultando agenda: {e}")


async def cmd_cita(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /cita <fecha> <hora> <nombre> <motivo>
    Ejemplo: /cita 2024-01-15 14:30 John Smith Llamada propiedad Milwaukee
    """
    user_id = str(update.effective_user.id)
    if user_id != OWNER_CHAT_ID:
        await update.message.reply_text("⛔ Solo el Jefe puede usar este comando.")
        return

    if not context.args or len(context.args) < 4:
        await update.message.reply_text(
            "⚠️ Uso: `/cita <fecha> <hora> <nombre> <motivo>`\n\n"
            "Ejemplo:\n"
            "`/cita 2024-01-15 14:30 John Smith Llamada sobre propiedad en Milwaukee`\n\n"
            "La fecha en formato: YYYY-MM-DD\n"
            "La hora en formato: HH:MM (24h, CST)",
            parse_mode="Markdown"
        )
        return

    ok, mod = _secretario_import()
    if not ok:
        await update.message.reply_text(f"⚠️ Calendar no disponible: {mod}")
        return

    fecha = context.args[0]
    hora  = context.args[1]
    # Nombre: siguientes dos palabras, motivo: el resto
    nombre = f"{context.args[2]} {context.args[3]}" if len(context.args) > 3 else context.args[2]
    motivo = " ".join(context.args[4:]) if len(context.args) > 4 else "Reunión Pinnacle"

    await update.message.reply_text(f"📅 Creando cita: {nombre} — {fecha} {hora}...")

    try:
        service = await asyncio.to_thread(mod["get_google_service"])
        if not service:
            await update.message.reply_text("⚠️ Google Calendar no configurado. Configura primero con /agenda.")
            return

        ok_cita, msg = await asyncio.to_thread(
            mod["crear_cita"], fecha, hora, nombre, motivo, 60, service
        )

        if ok_cita:
            await update.message.reply_text(
                f"✅ *Cita creada exitosamente*\n\n"
                f"📅 {fecha} a las {hora} CST\n"
                f"👤 {nombre}\n"
                f"📋 {motivo}\n\n"
                f"Recibirás recordatorio 30 min antes.",
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(f"❌ Error creando cita: {msg}")

    except Exception as e:
        await update.message.reply_text(f"⚠️ Error: {e}")


async def main():
    if not http_requests:
        logger.warning("⚠️  Librería 'requests' no instalada. Airtable y Tracy no funcionarán. Ejecuta: pip install requests")

    logger.info("Iniciando ALEX Bot — Capacidades Completas...")

    app = Application.builder().token(TELEGRAM_TOKEN).build()

    # Comandos
    app.add_handler(CommandHandler("start",       cmd_start))
    app.add_handler(CommandHandler("reset",       cmd_reset))
    app.add_handler(CommandHandler("memoria",     cmd_memoria))
    app.add_handler(CommandHandler("guardar",     cmd_guardar))
    app.add_handler(CommandHandler("historial",   cmd_historial))
    app.add_handler(CommandHandler("capacidades", cmd_capacidades))
    app.add_handler(CommandHandler("permitir",    cmd_permitir))
    app.add_handler(CommandHandler("bloquear",    cmd_bloquear))
    app.add_handler(CommandHandler("claude",      cmd_claude))
    app.add_handler(CommandHandler("tarea",       cmd_tarea))
    # El Secretario — Email y Calendario
    app.add_handler(CommandHandler("emails",      cmd_emails))
    app.add_handler(CommandHandler("responder",   cmd_responder))
    app.add_handler(CommandHandler("agenda",      cmd_agenda))
    app.add_handler(CommandHandler("cita",        cmd_cita))
    # LightRAG — Búsqueda semántica
    app.add_handler(CommandHandler("buscar",      cmd_buscar))
    app.add_handler(CommandHandler("reindexar",   cmd_reindexar))

    # Mensajes
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.VOICE,        handle_voice))
    app.add_handler(MessageHandler(filters.PHOTO,        handle_photo))
    app.add_handler(MessageHandler(filters.VIDEO,        handle_video))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(MessageHandler(filters.ALL,          handle_unknown))

    print("=" * 60)
    print("  ALEX Bot — Capacidades Completas")
    print("  Sub-agentes: Scout | Matemático | Fact-Checker | Tracy")
    print("  Airtable: Contacts | Leads | Deals | Notes & Activity")
    print("  El Secretario: /emails /responder /agenda /cita")
    print("  LightRAG: /buscar /reindexar")
    print("  Memoria: compartida con Claude Code")
    print("  /start /reset /guardar /memoria /historial /capacidades /claude")
    print("  Ctrl+C para detener")
    print("=" * 60)

    async with app:
        await app.initialize()
        await app.start()
        await app.updater.start_polling(drop_pending_updates=True)
        try:
            await asyncio.Event().wait()
        except (KeyboardInterrupt, SystemExit):
            pass
        finally:
            await app.updater.stop()
            await app.stop()
            await app.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
