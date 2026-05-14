#!/usr/bin/env python3
"""
sanitize_file.py — Redacta credenciales conocidas en un archivo de texto.

Hereda los patrones del bundler `build_claude_project_context.sh` y agrega
cobertura para GitHub PAT, JWTs (Supabase/Tracerfy), HuggingFace, Twilio,
Slack, Modal, Doppler, Replicate, named env-vars, y bloques PEM de private
keys.

Uso:
    python scripts/sanitize_file.py archivo.md
    python scripts/sanitize_file.py archivo.md --in-place
    python scripts/sanitize_file.py archivo.md --output out.md
    python scripts/sanitize_file.py archivo.md --check-only   # exit 1 si hay secrets

Por defecto crea `archivo.sanitized.md` al lado y NO modifica el original.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


# Lista de (pattern_regex, replacement, label).
# Orden importa — patrones más específicos antes que genéricos.
PATTERNS: list[tuple[str, str, str]] = [
    # Supabase URL — MUST come BEFORE Airtable table ID (avoids subdomain getting eaten by tbl pattern)
    (r'\bhttps://[a-z0-9-]+\.supabase\.(co|in|net)\b', '[REDACTED_SUPABASE_URL]', 'Supabase URL'),
    (r'\bdb\.[a-z0-9-]+\.supabase\.(co|in|net)\b', '[REDACTED_SUPABASE_DB_HOST]', 'Supabase DB host'),
    (r'\bsb_publishable_[A-Za-z0-9_-]{20,}', '[REDACTED_SUPABASE_PUBLISHABLE_KEY]', 'Supabase publishable key'),
    (r'\bsb_secret_[A-Za-z0-9_-]{20,}', '[REDACTED_SUPABASE_SECRET_KEY]', 'Supabase secret key'),
    # Postgres connection strings (with password embedded)
    (r'\bpostgres(?:ql)?://[^:\s]+:[^@\s]+@[^/\s]+/[A-Za-z0-9_-]+', 'postgresql://[REDACTED_USER]:[REDACTED_PASS]@[REDACTED_HOST]/[REDACTED_DB]', 'Postgres connection string'),
    (r'\bmysql://[^:\s]+:[^@\s]+@[^/\s]+/[A-Za-z0-9_-]+', 'mysql://[REDACTED_USER]:[REDACTED_PASS]@[REDACTED_HOST]/[REDACTED_DB]', 'MySQL connection string'),
    (r'\bmongodb(?:\+srv)?://[^:\s]+:[^@\s]+@[^/\s]+', 'mongodb://[REDACTED_USER]:[REDACTED_PASS]@[REDACTED_HOST]', 'MongoDB connection string'),
    # Google OAuth
    (r'\bGOCSPX-[A-Za-z0-9_-]+', '[REDACTED_GOOGLE_OAUTH_CLIENT_SECRET]', 'Google OAuth client secret'),
    (r'\b[0-9]{10,12}-[a-z0-9]{20,}\.apps\.googleusercontent\.com', '[REDACTED_GOOGLE_OAUTH_CLIENT_ID]', 'Google OAuth client ID'),
    # Airtable (PAT/IDs)
    (r'pat[A-Za-z0-9]{14}\.[a-f0-9]{40,}', '[REDACTED_AIRTABLE_PAT]', 'Airtable PAT'),
    (r'\bapp[A-Za-z0-9]{14}\b', '[REDACTED_AIRTABLE_BASE_ID]', 'Airtable base ID'),
    (r'\btbl[A-Za-z0-9]{14}\b', '[REDACTED_AIRTABLE_TABLE_ID]', 'Airtable table ID'),
    (r'\bfld[A-Za-z0-9]{14}\b', '[REDACTED_AIRTABLE_FIELD_ID]', 'Airtable field ID'),
    # Telegram
    (r'\b[0-9]{9,10}:[A-Za-z0-9_-]{35}\b', '[REDACTED_TELEGRAM_BOT_TOKEN]', 'Telegram token'),
    # Cloud providers
    (r'\bAKIA[A-Z0-9]{16}\b', '[REDACTED_AWS_ACCESS_KEY]', 'AWS access key'),
    (r'\bsk-ant-[A-Za-z0-9_-]+', '[REDACTED_ANTHROPIC_KEY]', 'Anthropic key'),
    (r'\bsk-proj-[A-Za-z0-9_-]+', '[REDACTED_OPENAI_KEY]', 'OpenAI project key'),
    (r'\bsk-[A-Za-z0-9_-]{30,}', '[REDACTED_OPENAI_KEY]', 'OpenAI key'),
    # GitHub
    (r'\bghp_[A-Za-z0-9]{36}\b', '[REDACTED_GITHUB_PAT]', 'GitHub PAT (classic)'),
    (r'\bgithub_pat_[A-Za-z0-9_]{82}\b', '[REDACTED_GITHUB_FINE_PAT]', 'GitHub PAT (fine-grained)'),
    (r'\bgh[ousr]_[A-Za-z0-9]{36}\b', '[REDACTED_GITHUB_TOKEN]', 'GitHub OAuth/User/Server/Refresh token'),
    # HuggingFace
    (r'\bhf_[A-Za-z0-9]{30,}', '[REDACTED_HF_TOKEN]', 'HuggingFace token'),
    # Doppler
    (r'\bdp\.(st|pt|sa|ct)\.[A-Za-z0-9_.-]+', '[REDACTED_DOPPLER_TOKEN]', 'Doppler token'),
    # Replicate
    (r'\br8_[A-Za-z0-9]{30,}', '[REDACTED_REPLICATE_TOKEN]', 'Replicate token'),
    # Twilio
    (r'\bAC[a-f0-9]{32}\b', '[REDACTED_TWILIO_SID]', 'Twilio Account SID'),
    # Slack
    (r'\bxox[bpasr]-[A-Za-z0-9-]{10,}', '[REDACTED_SLACK_TOKEN]', 'Slack token'),
    # Modal
    (r'\bmt[_-][A-Za-z0-9]{20,}', '[REDACTED_MODAL_TOKEN]', 'Modal token'),
    # Stripe
    (r'\bsk_live_[A-Za-z0-9]+', '[REDACTED_STRIPE_LIVE_KEY]', 'Stripe live key'),
    (r'\bsk_test_[A-Za-z0-9]+', '[REDACTED_STRIPE_TEST_KEY]', 'Stripe test key'),
    (r'\bpk_live_[A-Za-z0-9]+', '[REDACTED_STRIPE_LIVE_PUB]', 'Stripe live publishable'),
    (r'\bpk_test_[A-Za-z0-9]+', '[REDACTED_STRIPE_TEST_PUB]', 'Stripe test publishable'),
    # Supabase URL
    (r'https://[a-z0-9]+\.supabase\.(co|in)', '[REDACTED_SUPABASE_URL]', 'Supabase URL'),
    # JWT (Supabase anon/service, Tracerfy, generic)
    (r'\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[REDACTED_JWT]', 'JWT'),
    # Bearer
    (r'Bearer\s+[A-Za-z0-9._-]{30,}', 'Bearer [REDACTED_TOKEN]', 'Bearer header'),
    # Cloudinary
    (r'cloudinary://[^\s"\']+', 'cloudinary://[REDACTED]', 'Cloudinary URL'),
    # PEM private keys (line markers — multi-line blocks won't be fully redacted but markers warn)
    (r'-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----', '[REDACTED_PRIVATE_KEY_BEGIN]', 'Private key begin'),
    (r'-----END (RSA |EC |DSA )?PRIVATE KEY-----', '[REDACTED_PRIVATE_KEY_END]', 'Private key end'),
    # JSON service account fields
    (r'"client_email"\s*:\s*"[^"]+"', '"client_email": "[REDACTED]"', 'GCP client_email'),
    (r'"private_key"\s*:\s*"[^"]+"', '"private_key": "[REDACTED]"', 'GCP private_key'),
    (r'"private_key_id"\s*:\s*"[^"]+"', '"private_key_id": "[REDACTED]"', 'GCP private_key_id'),
    # Named env-var style: KEY = "value"
    (
        r'(GITHUB_TOKEN|GH_TOKEN|TELEGRAM_TOKEN|AIRTABLE_TOKEN|ANTHROPIC_KEY|OPENAI_KEY|TRACERFY_TOKEN|HEYGEN_API_KEY|HEYGEN_API_TOKEN|HEYGEN_AVATAR_ID_JORGE|HEYGEN_VOICE_ID_JORGE_EN|HEYGEN_VOICE_ID_JORGE_ES|MAKE_API_KEY|MAKE_API_TOKEN|TWILIO_AUTH_TOKEN|TWILIO_API_KEY|SUPABASE_ANON_KEY|SUPABASE_SERVICE_KEY|SUPABASE_KEY|SUPABASE_SERVICE_ROLE_KEY|CLERK_SECRET_KEY|CLERK_PUBLISHABLE_KEY|STRIPE_SECRET_KEY|MODAL_TOKEN|MODAL_TOKEN_ID|MODAL_TOKEN_SECRET|HF_TOKEN|HUGGINGFACE_TOKEN|GEMINI_API_KEY|GOOGLE_API_KEY|REPLICATE_API_TOKEN|BLOTATO_TOKEN|BLOTATO_API_KEY|ALEX_SECRET|X-Alex-Secret|SECRETARIO_EMAIL_PASSWORD|IMAP_PASSWORD|SMTP_PASSWORD)\s*[:=]\s*["\']?([A-Za-z0-9._/+=-]{16,})["\']?',
        r'\1=[REDACTED]',
        'named env-var credential'
    ),
    # Hostinger SSH-style account credentials (u + 9 digits and "pinnacle2026" style passwords)
    (r'\bu[0-9]{9}@[a-z0-9.-]+\.com\b', '[REDACTED_SSH_ACCOUNT]', 'SSH account'),
    # Generic "PASSWORD: foo" / "TOKEN: foo" not caught by named (after named pattern so it doesn't over-shadow)
    (r'\b(SECRET|PASSWORD|TOKEN|API_KEY)\s*[:=]\s*["\']?([A-Za-z0-9._-]{12,})["\']?', r'\1=[REDACTED]', 'generic SECRET/PASSWORD/TOKEN'),
    # UUID values that appear after credential keywords (handles markdown bold/code formatting)
    (r'(?i)(api[\W_]*key|access[\W_]*token|auth(?:orization)?[\W_]*token|secret[\W_]*key|client[\W_]*secret|webhook[\W_]*token|token|secret|password)[\s:=*_`<>"\']+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b', r'\1: [REDACTED_UUID_CREDENTIAL]', 'UUID after credential keyword'),
    # "Authorization: Token <uuid>" — explicit header
    (r'Authorization:\s*Token\s+[0-9a-f-]+', 'Authorization: Token [REDACTED]', 'Authorization Token header'),
    # Bare passwords in URL-like patterns user:password@host
    (r'://([^:/\s]+):([A-Za-z0-9._@!#$%^&*-]{6,})@', '://[REDACTED_USER]:[REDACTED_PASS]@', 'URL-style user:password'),
]


def sanitize(text: str) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    for pattern, replacement, label in PATTERNS:
        new_text, n = re.subn(pattern, replacement, text)
        if n:
            counts[label] = counts.get(label, 0) + n
        text = new_text
    return text, counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Archivo de entrada")
    parser.add_argument("--output", type=Path, help="Archivo de salida (default: input.sanitized.md)")
    parser.add_argument("--in-place", action="store_true", help="Sobrescribe el input")
    parser.add_argument("--check-only", action="store_true", help="No escribe nada. Exit 1 si encuentra patrones.")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"ERROR: {args.input} not found", file=sys.stderr)
        return 2

    text = args.input.read_text(encoding="utf-8")
    sanitized, counts = sanitize(text)

    print(f"Source: {args.input} ({len(text):,} bytes)")
    if counts:
        print("Redactions found:")
        for label, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            print(f"  {n:>4}  {label}")
        total = sum(counts.values())
        print(f"  TOTAL: {total}")
    else:
        print("Redactions found: 0 (clean)")

    if args.check_only:
        return 1 if counts else 0

    out_path = args.input if args.in_place else (args.output or args.input.with_suffix(".sanitized.md"))
    out_path.write_text(sanitized, encoding="utf-8")
    print(f"Wrote: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
