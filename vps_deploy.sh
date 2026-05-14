#!/bin/bash
# ============================================================
#  ALEX VPS DEPLOY SCRIPT
#  Ejecutar como root en el VPS de Hostinger (Ubuntu/Debian)
#  Uso: bash vps_deploy.sh
# ============================================================

set -e   # salir si cualquier comando falla

REPO_URL="https://github.com/geocarp24/alex-real-estate-system.git"
APP_DIR="/opt/alex-bot"
SERVICE_NAME="alex-bot"
PYTHON_MIN="3.10"

echo "============================================================"
echo "  ALEX BOT — Deploy en Hostinger VPS"
echo "============================================================"

# ── 1. Actualizar sistema ─────────────────────────────────────
echo ""
echo "[1/7] Actualizando paquetes del sistema..."
apt-get update -y && apt-get upgrade -y

# ── 2. Instalar dependencias del sistema ──────────────────────
echo ""
echo "[2/7] Instalando Python, git, ffmpeg..."
apt-get install -y \
    python3 python3-pip python3-venv python3-dev \
    git ffmpeg curl build-essential libssl-dev

# ── 3. Clonar o actualizar el repositorio ────────────────────
echo ""
echo "[3/7] Clonando repositorio desde GitHub..."
if [ -d "$APP_DIR" ]; then
    echo "  → Directorio existe. Haciendo pull..."
    cd "$APP_DIR"
    git pull origin master
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── 4. Crear entorno virtual e instalar dependencias ─────────
echo ""
echo "[4/7] Instalando dependencias Python..."
cd "$APP_DIR"
python3 -m venv venv
source venv/bin/activate

# Upgrade pip primero
pip install --upgrade pip

# Instalar dependencias
pip install -r telegram_bot/requirements.txt

deactivate
echo "  → Dependencias instaladas correctamente."

# ── 5. Crear directorio de sesiones ──────────────────────────
mkdir -p "$APP_DIR/telegram_bot/sessions"

# ── 6. Configurar git para sync de memoria ───────────────────
echo ""
echo "[5/7] Configurando git para sincronización de memoria..."
cd "$APP_DIR"
git config user.email "alex-bot@pinnaclegroupwi.com"
git config user.name "ALEX Bot VPS"

# Guardar credenciales de git (para push automático de memoria)
# NOTA: Reemplazar TOKEN con tu GitHub Personal Access Token
echo ""
echo "  ⚠️  IMPORTANTE: Necesitas un GitHub Personal Access Token para"
echo "  que el bot pueda hacer push automático de la memoria."
echo ""
echo "  Crea uno en: https://github.com/settings/tokens"
echo "  Permisos necesarios: repo (read/write)"
echo ""
read -p "  Ingresa tu GitHub Personal Access Token (o Enter para omitir): " GITHUB_TOKEN

if [ -n "$GITHUB_TOKEN" ]; then
    git remote set-url origin "https://geocarp24:${GITHUB_TOKEN}@github.com/geocarp24/alex-real-estate-system.git"
    echo "  → Token configurado. El bot puede hacer push de memoria."
    # Guardar el token para que persista
    git config credential.helper store
else
    echo "  → Omitido. El bot correrá sin sync automático de memoria."
fi

# ── 7. Crear servicio systemd ─────────────────────────────────
echo ""
echo "[6/7] Creando servicio systemd..."

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=ALEX Real Estate Bot (Telegram)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStartPre=/bin/bash -c 'cd ${APP_DIR} && git pull origin master 2>/dev/null || true'
ExecStart=${APP_DIR}/venv/bin/python3 ${APP_DIR}/telegram_bot/alex_bot.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=alex-bot

# Limite de recursos (ajusta según RAM disponible)
MemoryMax=800M

[Install]
WantedBy=multi-user.target
EOF

# ── 8. Habilitar y arrancar el servicio ──────────────────────
echo ""
echo "[7/7] Habilitando y arrancando el servicio..."
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}

# Verificar estado
sleep 3
echo ""
echo "============================================================"
echo "  ESTADO DEL SERVICIO:"
echo "============================================================"
systemctl status ${SERVICE_NAME} --no-pager -l

echo ""
echo "============================================================"
echo "  ✅ DEPLOY COMPLETO"
echo ""
echo "  Comandos útiles:"
echo "  → Ver logs en vivo:    journalctl -u alex-bot -f"
echo "  → Reiniciar bot:       systemctl restart alex-bot"
echo "  → Detener bot:         systemctl stop alex-bot"
echo "  → Ver estado:          systemctl status alex-bot"
echo "  → Actualizar código:   cd /opt/alex-bot && git pull && systemctl restart alex-bot"
echo "============================================================"
