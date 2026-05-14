#!/usr/bin/env python3
"""
ALEX Claude Worker — Daemon puente Bot ↔ Claude Code
=======================================================
Corre como servicio systemd (claude-worker.service).
Monitorea claude_inbox.json, ejecuta claude --print,
y envía el resultado directo a Telegram — sin que Jorge
tenga que copiar y pegar nada.

Flujo:
  Bot escribe → claude_inbox.json
  Worker detecta → ejecuta Claude Code CLI
  Worker envía resultado → Telegram (Jorge)
  Worker actualiza → shared_conversation.json
"""

import json
import logging
import os
import subprocess
import time
import uuid
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
load_dotenv(Path(__file__).parent / ".env")

PROJECT_DIR    = Path(__file__).parent
INBOX          = PROJECT_DIR / "agents" / "claude_inbox.json"
OUTBOX         = PROJECT_DIR / "agents" / "claude_outbox.json"
SHARED_CONV    = PROJECT_DIR / "agents" / "shared_conversation.json"

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
ANTHROPIC_KEY  = os.getenv("ANTHROPIC_KEY", "")
OWNER_CHAT_ID  = "8402370952"

POLL_INTERVAL  = 2    # segundos entre checks del inbox
CLAUDE_TIMEOUT = 300  # 5 minutos max por tarea
MAX_SHARED     = 60   # mensajes máx en shared_conversation

logging.basicConfig(
    format="%(asctime)s [WORKER] %(levelname)s — %(message)s",
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(PROJECT_DIR / "agents" / "claude_worker.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("claude_worker")


# ─────────────────────────────────────────────
# TELEGRAM — envío directo (Fase 3: bidireccional)
# ─────────────────────────────────────────────

def send_telegram(chat_id: str, text: str, parse_mode: str = None):
    """Envía un mensaje a Telegram directamente desde el worker (sin pasar por el bot)."""
    if not TELEGRAM_TOKEN:
        logger.error("TELEGRAM_TOKEN no configurado")
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    try:
        # Telegram limita a 4096 chars — enviar en chunks si es necesario
        chunks = [text[i:i+4000] for i in range(0, len(text), 4000)]
        for chunk in chunks:
            payload["text"] = chunk
            r = requests.post(url, json=payload, timeout=15)
            if not r.ok:
                logger.warning(f"Telegram API error: {r.status_code} — {r.text[:200]}")
        return True
    except Exception as e:
        logger.error(f"Error enviando a Telegram: {e}")
        return False


# ─────────────────────────────────────────────
# INBOX / OUTBOX
# ─────────────────────────────────────────────

def load_inbox() -> list:
    if INBOX.exists():
        try:
            return json.loads(INBOX.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def save_inbox(tasks: list):
    INBOX.write_text(json.dumps(tasks, ensure_ascii=False, indent=2), encoding="utf-8")


def load_outbox() -> list:
    if OUTBOX.exists():
        try:
            return json.loads(OUTBOX.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def save_outbox(results: list):
    # Guardar solo los últimos 100 resultados
    OUTBOX.write_text(json.dumps(results[-100:], ensure_ascii=False, indent=2), encoding="utf-8")


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
        "role": role,
        "content": content,
        "channel": channel,
        "timestamp": datetime.now().isoformat()
    })
    messages = messages[-MAX_SHARED:]
    SHARED_CONV.write_text(
        json.dumps({"messages": messages, "updated": datetime.now().isoformat()},
                   ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def get_history_context(max_messages: int = 20) -> str:
    """Formatea el historial compartido como contexto para Claude."""
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
        txt = m.get("content", "")
        if isinstance(txt, list):
            txt = " ".join(b.get("text", "") for b in txt if isinstance(b, dict))
        lines.append(f"{ts} [{ch}] {who}: {txt[:400]}")
    lines.append("[Fin del historial compartido]")
    return "\n".join(lines)


# ─────────────────────────────────────────────
# PROCESAMIENTO DE TAREAS
# ─────────────────────────────────────────────

def run_claude_cli(prompt: str) -> tuple[bool, str]:
    """Ejecuta claude --print y devuelve (éxito, resultado)."""
    env = {**os.environ, "ANTHROPIC_API_KEY": ANTHROPIC_KEY}
    try:
        result = subprocess.run(
            ["claude", "--print", prompt],
            capture_output=True, text=True,
            timeout=CLAUDE_TIMEOUT,
            cwd=str(PROJECT_DIR),
            env=env
        )
        if result.returncode == 0:
            output = result.stdout.strip()
            return True, output or "✅ Tarea completada."
        else:
            return False, f"Error Claude Code (código {result.returncode}):\n{result.stderr.strip()[:500]}"
    except subprocess.TimeoutExpired:
        return False, f"⏱ Timeout: la tarea tardó más de {CLAUDE_TIMEOUT//60} minutos."
    except FileNotFoundError:
        return False, "❌ Claude Code CLI no encontrado en /usr/local/bin/claude"
    except Exception as e:
        return False, f"❌ Error inesperado: {str(e)}"


def process_task(task: dict, all_tasks: list) -> dict:
    """Procesa una tarea del inbox y devuelve el resultado."""
    task_id  = task.get("task_id", str(uuid.uuid4()))
    prompt   = task.get("prompt", "")
    chat_id  = task.get("chat_id", OWNER_CHAT_ID)
    source   = task.get("source", "telegram")

    logger.info(f"Procesando tarea {task_id[:8]}... | {prompt[:60]}")

    # Marcar como processing en el inbox
    for t in all_tasks:
        if t.get("task_id") == task_id:
            t["status"] = "processing"
            t["started_at"] = datetime.now().isoformat()
    save_inbox(all_tasks)

    # Construir prompt con historial como contexto
    history_ctx = get_history_context(max_messages=20)
    full_prompt = f"{history_ctx}\n\n[Nueva tarea desde {source.upper()}]:\n{prompt}" if history_ctx else prompt

    # Ejecutar Claude Code
    success, response = run_claude_cli(full_prompt)

    result = {
        "task_id":    task_id,
        "prompt":     prompt,
        "response":   response,
        "success":    success,
        "chat_id":    chat_id,
        "source":     source,
        "completed_at": datetime.now().isoformat()
    }

    # Guardar en outbox
    outbox = load_outbox()
    outbox.append(result)
    save_outbox(outbox)

    # Actualizar shared_conversation
    if success:
        append_shared_conv("user",      prompt,   source)
        append_shared_conv("assistant", response, "claude_code")

    # Marcar como done en inbox
    for t in all_tasks:
        if t.get("task_id") == task_id:
            t["status"] = "done"
            t["completed_at"] = result["completed_at"]
    save_inbox(all_tasks)

    return result


# ─────────────────────────────────────────────
# LOOP PRINCIPAL
# ─────────────────────────────────────────────

def main():
    logger.info("=" * 55)
    logger.info("  ALEX Claude Worker — Iniciando")
    logger.info(f"  Inbox:  {INBOX}")
    logger.info(f"  Outbox: {OUTBOX}")
    logger.info(f"  Poll:   cada {POLL_INTERVAL}s | Timeout: {CLAUDE_TIMEOUT}s")
    logger.info("=" * 55)

    # Asegurar que existan los archivos
    for f in [INBOX, OUTBOX]:
        if not f.exists():
            f.write_text("[]", encoding="utf-8")

    while True:
        try:
            tasks = load_inbox()
            pending = [t for t in tasks if t.get("status") == "pending"]

            for task in pending:
                chat_id = task.get("chat_id", OWNER_CHAT_ID)

                # Notificar a Jorge que empezamos
                send_telegram(chat_id, "⚙️ Claude Code procesando tu tarea...")

                result = process_task(task, tasks)

                # Enviar resultado a Telegram (Fase 3 — bidireccional)
                if result["success"]:
                    header = f"✅ *Claude Code — Resultado*\n\n"
                    send_telegram(chat_id, header + result["response"], parse_mode="Markdown")
                else:
                    send_telegram(chat_id, result["response"])

                logger.info(f"Tarea {task.get('task_id','')[:8]} — {'OK' if result['success'] else 'ERROR'}")

        except Exception as e:
            logger.error(f"Error en loop principal: {e}", exc_info=True)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
