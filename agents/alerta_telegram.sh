#!/bin/bash
# ═══════════════════════════════════════════════════════
# ALERTA_TELEGRAM.SH — Sistema de Alertas de Seguridad ALEX
# Uso: bash alerta_telegram.sh "NIVEL" "DESCRIPCION" "SOLUCIONES"
# Niveles: CRITICO | ADVERTENCIA | ATENCION | INFO
# ═══════════════════════════════════════════════════════

BOT_TOKEN="[REDACTED_TELEGRAM_BOT_TOKEN]"
CHAT_ID="8402370952"
API_URL="https://api.telegram.org/bot${BOT_TOKEN}/sendMessage"

NIVEL="${1:-INFO}"
DESCRIPCION="${2:-Sin descripcion}"
SOLUCIONES="${3:-Revisar logs del sistema}"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

case "$NIVEL" in
  CRITICO)     BADGE="CRITICO" ;;
  ADVERTENCIA) BADGE="ADVERTENCIA" ;;
  ATENCION)    BADGE="ATENCION" ;;
  INFO)        BADGE="INFO" ;;
  *)           BADGE="$NIVEL" ;;
esac

MESSAGE="ALERTA ALEX - ${BADGE}

Situacion: ${DESCRIPCION}

Detectado: ${TIMESTAMP}

Posibles soluciones:
${SOLUCIONES}

-- Responde al bot:
/permitir - Autorizar esta accion y continuar
/bloquear - Denegar y detener la operacion

-- Sistema ALEX (notificacion automatica)"

RESPONSE=$(curl -s -X POST "$API_URL" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${MESSAGE}")

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "ALERTA ENVIADA OK - ${NIVEL}: ${DESCRIPCION}"
  exit 0
else
  echo "ERROR enviando alerta: $RESPONSE"
  exit 1
fi
