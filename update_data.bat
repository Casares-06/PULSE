@echo off
title Actualizar datos de Pulse
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo No se encuentra el entorno virtual .venv.
    pause
    exit /b 1
)

set "PULSE_ZIP=%~1"
if not defined PULSE_ZIP (
    set /p "PULSE_ZIP=Ruta completa del ZIP de Spotify: "
)

if not exist "%PULSE_ZIP%" (
    echo No se encuentra el ZIP indicado.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" "src\process_data.py" --zip "%PULSE_ZIP%"
pause
