"""
ALEX RAG — Sistema de búsqueda semántica con LightRAG
Indexa: memoria_ALex.md, Airtable (Contacts, Leads, Deals), shared_conversation.json
"""
import asyncio
import os
import json
import requests
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('/opt/alex-bot/.env')

from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.utils import EmbeddingFunc

BASE_DIR = Path('/opt/alex-bot/rag/data')
BASE_DIR.mkdir(parents=True, exist_ok=True)

ANTHROPIC_KEY = os.getenv('ANTHROPIC_KEY')
AIRTABLE_TOKEN = os.getenv('AIRTABLE_TOKEN', '[REDACTED_AIRTABLE_PAT]')
AIRTABLE_BASE = '[REDACTED_AIRTABLE_BASE_ID]'

# ── LLM via Anthropic (Claude) ────────────────────────────────
async def claude_complete(prompt, system_prompt=None, **kwargs):
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    messages = [{"role": "user", "content": prompt}]
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=system_prompt or "You are a helpful assistant.",
        messages=messages
    )
    return response.content[0].text

async def embed_texts(texts):
    """Embeddings simples usando el modelo de Claude via openai-compatible"""
    import numpy as np
    # Usamos nano-vectordb con embeddings hash simples (sin costo de API)
    embeddings = []
    for text in texts:
        # Simple hash-based embedding para demo (reemplazar con real si se necesita)
        h = hash(text[:512]) % (2**31)
        vec = np.array([float((h >> i) & 1) for i in range(384)], dtype=np.float32)
        vec = vec / (np.linalg.norm(vec) + 1e-8)
        embeddings.append(vec)
    return np.array(embeddings)

def get_rag():
    rag = LightRAG(
        working_dir=str(BASE_DIR),
        llm_model_func=claude_complete,
        embedding_func=EmbeddingFunc(
            embedding_dim=384,
            max_token_size=512,
            func=embed_texts
        )
    )
    return rag

# ── FUENTES DE DATOS ──────────────────────────────────────────
def load_memoria():
    path = '/opt/alex-bot/memoria_ALex.md'
    if os.path.exists(path):
        return open(path).read()
    return ""

def load_airtable_table(table_id, table_name):
    headers = {'Authorization': f'Bearer {AIRTABLE_TOKEN}'}
    records = []
    offset = None
    while True:
        url = f'https://api.airtable.com/v0/{AIRTABLE_BASE}/{table_id}'
        params = {'pageSize': 100}
        if offset:
            params['offset'] = offset
        r = requests.get(url, headers=headers, params=params)
        if not r.ok:
            print(f"Error {table_name}: {r.text}")
            break
        data = r.json()
        records.extend(data.get('records', []))
        offset = data.get('offset')
        if not offset:
            break
    return records

def records_to_text(records, table_name):
    lines = [f"=== {table_name} ==="]
    for rec in records:
        f = rec.get('fields', {})
        line = f"[{table_name} ID:{rec['id']}] " + " | ".join(f"{k}: {v}" for k, v in f.items() if v)
        lines.append(line)
    return "\n".join(lines)

def load_conversation():
    path = '/opt/alex-bot/agents/shared_conversation.json'
    if os.path.exists(path):
        data = json.load(open(path))
        msgs = data.get('messages', [])
        lines = ["=== CONVERSACIONES RECIENTES ==="]
        for m in msgs[-30:]:
            lines.append(f"[{m.get('channel','?')}] {m.get('role','?')}: {m.get('content','')[:300]}")
        return "\n".join(lines)
    return ""

# ── INDEXAR TODO ──────────────────────────────────────────────
async def index_all():
    rag = get_rag()
    await rag.initialize_storages()

    docs = []

    # 1. Memoria operacional
    mem = load_memoria()
    if mem:
        docs.append(mem)
        print("✓ memoria_ALex.md cargada")

    # 2. Conversaciones
    conv = load_conversation()
    if conv:
        docs.append(conv)
        print("✓ shared_conversation.json cargada")

    # 3. Airtable — Contacts
    contacts = load_airtable_table('[REDACTED_AIRTABLE_TABLE_ID]', 'Contacts')
    if contacts:
        docs.append(records_to_text(contacts, 'Contacts'))
        print(f"✓ {len(contacts)} contactos de Airtable")

    # 4. Airtable — Leads
    leads = load_airtable_table('[REDACTED_AIRTABLE_TABLE_ID]', 'Leads')
    if leads:
        docs.append(records_to_text(leads, 'Leads'))
        print(f"✓ {len(leads)} leads de Airtable")

    # 5. Airtable — Deals
    deals = load_airtable_table('[REDACTED_AIRTABLE_TABLE_ID]', 'Deals')
    if deals:
        docs.append(records_to_text(deals, 'Deals'))
        print(f"✓ {len(deals)} deals de Airtable")

    # Insertar todo en LightRAG
    print(f"\nIndexando {len(docs)} documentos...")
    await rag.ainsert(docs)
    print("✅ Indexación completa")

# ── QUERY ─────────────────────────────────────────────────────
async def query(question: str, mode: str = "hybrid") -> str:
    rag = get_rag()
    await rag.initialize_storages()
    result = await rag.aquery(question, param=QueryParam(mode=mode))
    return result

# ── CLI ───────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 alex_rag.py [index|query] [pregunta]")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "index":
        asyncio.run(index_all())
    elif cmd == "query" and len(sys.argv) > 2:
        q = " ".join(sys.argv[2:])
        result = asyncio.run(query(q))
        print(result)
    else:
        print("Comandos: index | query <pregunta>")
