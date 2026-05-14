#!/usr/bin/env python3
"""
ALEX Claude API Server
======================
Endpoint HTTP que recibe tareas desde ALEX Bot (o cualquier sistema),
ejecuta Claude Code CLI, y envía el resultado directo a Telegram.

Endpoints:
  POST /task          — encola una nueva tarea
  GET  /task/<id>     — consulta estado/resultado de una tarea
  GET  /health        — health check del servidor
  GET  /status        — estado general del sistema

Seguridad: header X-Alex-Secret requerido en todos los requests.

Puerto: 5001 (localhost — el bot accede como http://localhost:5001)
"""

import json
import logging
import os
import queue
import subprocess
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv
from flask import Flask, request, jsonify

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env")

PROJECT_DIR    = Path(__file__).parent
SHARED_CONV    = PROJECT_DIR / "agents" / "shared_conversation.json"
LOG_FILE       = PROJECT_DIR / "agents" / "claude_api_server.log"

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
ANTHROPIC_KEY  = os.getenv("ANTHROPIC_KEY", "")
ALEX_SECRET    = os.getenv("ALEX_SECRET", "pinnacle2024ALEXsecret99")
OWNER_CHAT_ID  = "8402370952"

SERVER_PORT    = 5001
CLAUDE_TIMEOUT = 300   # 5 minutos max por tarea
MAX_SHARED     = 60

logging.basicConfig(
    format="%(asctime)s [API] %(levelname)s — %(message)s",
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE, encoding="utf-8")
    ]
)
logger = logging.getLogger("claude_api")

app = Flask(__name__)

# Almacén en memoria de tareas (task_id → resultado)
tasks_store: dict = {}
task_queue: queue.Queue = queue.Queue()


# ─────────────────────────────────────────────
# SEGURIDAD
# ─────────────────────────────────────────────

def require_secret(f):
    """Decorator: valida X-Alex-Secret en todos los endpoints."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        secret = request.headers.get("X-Alex-Secret", "")
        if secret != ALEX_SECRET:
            logger.warning(f"Acceso denegado — secret inválido desde {request.remote_addr}")
            return jsonify({"error": "Unauthorized"}), 403
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────────────────────────
# TELEGRAM (bidireccional — Fase 3)
# ─────────────────────────────────────────────

def send_telegram(chat_id: str, text: str):
    """Envía mensaje a Telegram directamente desde el API server."""
    if not TELEGRAM_TOKEN:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    chunks = [text[i:i+4000] for i in range(0, len(text), 4000)]
    for chunk in chunks:
        try:
            requests.post(url, json={"chat_id": chat_id, "text": chunk}, timeout=15)
        except Exception as e:
            logger.error(f"Error Telegram: {e}")


# ─────────────────────────────────────────────
# SHARED CONVERSATION (espejo)
# ─────────────────────────────────────────────

def append_shared_conv(role: str, content: str, channel: str = "claude_code"):
    messages = []
    if SHARED_CONV.exists():
        try:
            data = json.loads(SHARED_CONV.read_text(encoding="utf-8"))
            messages = data.get("messages", [])
        except Exception:
            pass
    messages.append({
        "role": role, "content": content,
        "channel": channel, "timestamp": datetime.now().isoformat()
    })
    messages = messages[-MAX_SHARED:]
    SHARED_CONV.write_text(
        json.dumps({"messages": messages, "updated": datetime.now().isoformat()},
                   ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def get_history_context(max_messages: int = 20) -> str:
    if not SHARED_CONV.exists():
        return ""
    try:
        data = json.loads(SHARED_CONV.read_text(encoding="utf-8"))
        messages = data.get("messages", [])[-max_messages:]
    except Exception:
        return ""
    if not messages:
        return ""
    lines = ["[Conversación reciente — historial compartido Telegram↔Claude Code]"]
    for m in messages:
        ch  = m.get("channel", "?").upper()
        who = "Jorge" if m["role"] == "user" else "ALEX"
        ts  = m.get("timestamp", "")[:16].replace("T", " ")
        txt = str(m.get("content", ""))
        lines.append(f"{ts} [{ch}] {who}: {txt[:400]}")
    lines.append("[Fin del historial]")
    return "\n".join(lines)


# ─────────────────────────────────────────────
# CLAUDE CODE CLI
# ─────────────────────────────────────────────

def load_shared_memory() -> str:
    """Carga memoria_ALex.md para inyectarla como contexto en cada tarea."""
    memoria_file = PROJECT_DIR / "memoria_ALex.md"
    if memoria_file.exists():
        content = memoria_file.read_text(encoding="utf-8")
        # Limitar a 4000 chars para no saturar el prompt
        return content[:4000]
    return ""


def run_claude_cli(prompt: str) -> tuple[bool, str]:
    """
    Ejecuta Claude Code con acceso completo al proyecto:
    - --dangerously-skip-permissions: Claude puede leer/escribir archivos y ejecutar bash
    - cwd=PROJECT_DIR: carga CLAUDE.md y los agentes del proyecto automáticamente
    - Memoria inyectada: Claude tiene contexto operacional desde el primer token
    """
    env = {**os.environ, "ANTHROPIC_API_KEY": ANTHROPIC_KEY}

    # Inyectar memoria compartida como contexto
    memoria = load_shared_memory()
    history_ctx = get_history_context(15)

    context_block = ""
    if memoria:
        context_block += f"[MEMORIA OPERACIONAL DE ALEX — contexto compartido]:\n{memoria}\n\n"
    if history_ctx:
        context_block += f"{history_ctx}\n\n"

    full_prompt = f"{context_block}[TAREA DELEGADA POR ALEX]:\n{prompt}" if context_block else prompt

    try:
        result = subprocess.run(
            ["claude", "--print", "--dangerously-skip-permissions", full_prompt],
            capture_output=True, text=True,
            timeout=CLAUDE_TIMEOUT,
            cwd=str(PROJECT_DIR),
            env=env
        )
        if result.returncode == 0:
            return True, result.stdout.strip() or "✅ Tarea completada."
        return False, f"❌ Error {result.returncode}:\n{result.stderr.strip()[:500]}"
    except subprocess.TimeoutExpired:
        return False, f"⏱ Timeout: tarea tardó más de {CLAUDE_TIMEOUT//60} min."
    except FileNotFoundError:
        return False, "❌ Claude Code CLI no encontrado."
    except Exception as e:
        return False, f"❌ Error: {str(e)}"


# ─────────────────────────────────────────────
# WORKER THREAD (procesa la cola en background)
# ─────────────────────────────────────────────

def worker_loop():
    """Loop en background que procesa tareas de la cola."""
    logger.info("Worker thread iniciado")
    while True:
        try:
            task = task_queue.get(timeout=1)
            task_id = task["task_id"]
            prompt  = task["prompt"]
            chat_id = task.get("chat_id", OWNER_CHAT_ID)
            source  = task.get("source", "telegram")

            logger.info(f"Procesando {task_id[:8]}... | {prompt[:60]}")

            # Actualizar estado
            tasks_store[task_id]["status"] = "processing"
            tasks_store[task_id]["started_at"] = datetime.now().isoformat()

            # Notificar a Jorge que empezamos (solo si viene de Telegram directamente)
            if source != "alex_bot":
                send_telegram(chat_id, "⚙️ Claude Code procesando tu tarea...")

            # Construir prompt con contexto histórico
            history_ctx = get_history_context(20)
            full_prompt = f"{history_ctx}\n\n[Tarea desde {source.upper()}]:\n{prompt}" if history_ctx else prompt

            # Ejecutar Claude Code
            success, response = run_claude_cli(full_prompt)

            # Guardar resultado
            tasks_store[task_id].update({
                "status":       "done" if success else "error",
                "response":     response,
                "success":      success,
                "completed_at": datetime.now().isoformat()
            })

            # Actualizar espejo de conversación
            if success:
                append_shared_conv("user",      prompt,   source)
                append_shared_conv("assistant", response, "claude_code")

            # Enviar resultado a Telegram solo si viene de Telegram directamente
            # Si source=="alex_bot", el bot está haciendo polling — no enviar duplicado
            if source != "alex_bot":
                if success:
                    send_telegram(chat_id, f"✅ Claude Code:\n\n{response}")
                else:
                    send_telegram(chat_id, response)

            logger.info(f"Tarea {task_id[:8]} — {'OK' if success else 'ERROR'}")
            task_queue.task_done()

        except queue.Empty:
            continue
        except Exception as e:
            logger.error(f"Error en worker: {e}", exc_info=True)


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":    "ok",
        "service":   "ALEX Claude API Server",
        "queue":     task_queue.qsize(),
        "tasks":     len(tasks_store),
        "timestamp": datetime.now().isoformat()
    })


@app.route("/task", methods=["POST"])
@require_secret
def create_task():
    """
    Recibe una tarea, la encola y devuelve el task_id.
    Body JSON: { "prompt": "...", "chat_id": "...", "source": "telegram|claudecode|..." }
    """
    data = request.get_json(silent=True)
    if not data or not data.get("prompt"):
        return jsonify({"error": "Missing 'prompt' in body"}), 400

    task_id = str(uuid.uuid4())
    task = {
        "task_id":    task_id,
        "prompt":     data["prompt"],
        "chat_id":    str(data.get("chat_id", OWNER_CHAT_ID)),
        "source":     data.get("source", "telegram"),
        "status":     "pending",
        "created_at": datetime.now().isoformat(),
        "response":   None,
        "success":    None
    }

    tasks_store[task_id] = task
    task_queue.put(task)

    logger.info(f"Nueva tarea encolada: {task_id[:8]} | {task['prompt'][:60]}")

    return jsonify({
        "task_id": task_id,
        "status":  "pending",
        "message": "Tarea encolada. Recibirás el resultado en Telegram."
    }), 202


@app.route("/task/<task_id>", methods=["GET"])
@require_secret
def get_task(task_id):
    """Consulta el estado y resultado de una tarea."""
    task = tasks_store.get(task_id)
    if not task:
        return jsonify({"error": "Tarea no encontrada"}), 404
    return jsonify(task)


@app.route("/status", methods=["GET"])
@require_secret
def system_status():
    """Estado general del sistema."""
    done    = sum(1 for t in tasks_store.values() if t["status"] == "done")
    errors  = sum(1 for t in tasks_store.values() if t["status"] == "error")
    pending = sum(1 for t in tasks_store.values() if t["status"] == "pending")
    processing = sum(1 for t in tasks_store.values() if t["status"] == "processing")

    return jsonify({
        "service":     "ALEX Claude API Server",
        "port":        SERVER_PORT,
        "queue_size":  task_queue.qsize(),
        "tasks_total": len(tasks_store),
        "tasks_done":  done,
        "tasks_error": errors,
        "tasks_pending": pending,
        "tasks_processing": processing,
        "timestamp":   datetime.now().isoformat()
    })


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    # Iniciar worker thread en background
    worker = threading.Thread(target=worker_loop, daemon=True)
    worker.start()

    logger.info("=" * 55)
    logger.info("  ALEX Claude API Server — Iniciando")
    logger.info(f"  Puerto: {SERVER_PORT}")
    logger.info(f"  Endpoints: POST /task | GET /task/<id> | GET /health")
    logger.info(f"  Auth: X-Alex-Secret requerido")
    logger.info("=" * 55)

    app.run(host="0.0.0.0", port=SERVER_PORT, debug=False, threaded=True)
