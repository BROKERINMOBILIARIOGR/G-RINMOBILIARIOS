@echo off
setlocal
cd /d "%~dp0"

echo ================================================
echo   PANEL G&R - ACCESO DESDE ANDROID
echo ================================================
echo.
echo Inicia el panel y deja esta ventana abierta.
echo Cuando aparezca "Panel en la red Wi-Fi", abre esa direccion
echo en Chrome desde tu Android conectado al mismo Wi-Fi.
echo.
echo Ejemplo: http://192.168.1.20:8765/admin/
echo.
python admin_server.py
if errorlevel 1 (
  echo.
  echo No se pudo iniciar. Verifica que Python este instalado y configurado.
)
echo.
pause
