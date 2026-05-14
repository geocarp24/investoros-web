@echo off
echo ============================================
echo   Instalando dependencias de ALEX Bot
echo ============================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado.
    echo Descargalo desde https://python.org/downloads
    echo Asegurate de marcar "Add Python to PATH" al instalar
    pause
    exit /b 1
)

echo Python encontrado. Instalando paquetes...
echo.

pip install python-telegram-bot==21.6
pip install anthropic
pip install faster-whisper
pip install requests

echo.
echo ============================================
echo   Instalacion completada!
echo   Ahora puedes correr: iniciar_bot.bat
echo ============================================
pause
