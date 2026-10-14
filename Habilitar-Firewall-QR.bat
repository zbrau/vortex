@echo off
title Configurar Red y Firewall para Vortex
echo ===================================================================
echo        CONFIGURACION DE RED Y FIREWALL PARA VORTEX (LAN / QR)
echo ===================================================================
echo.

:: Verificar si ya tenemos permisos de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [SOLICITANDO PERMISOS DE ADMINISTRADOR...]
    echo Aparecera una ventana de Windows preguntando si deseas permitir cambios.
    echo Haz clic en "SI".
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo 1. Cambiando tipo de red de Publica a Privada (Permite comunicacion Ethernet <-> Wi-Fi)...
powershell -Command "Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private"
if %errorlevel% equ 0 (
    echo    [OK] Red configurada como Privada (Hogar/Oficina).
) else (
    echo    [AVISO] No se pudo cambiar el perfil de red.
)
echo.

echo 2. Habilitando puerto 6767 (TCP) en el Firewall de Windows para todas las redes...
netsh advfirewall firewall delete rule name="Vortex LAN Server" >nul 2>&1
netsh advfirewall firewall add rule name="Vortex LAN Server" dir=in action=allow protocol=TCP localport=6767 profile=any
if %errorlevel% equ 0 (
    echo    [OK] Regla agregada al Firewall con exito.
) else (
    echo    [ERROR] Fallo al agregar la regla al Firewall.
)
echo.

echo 3. Permitiendo ping local ICMP (para conexion instantanea entre movil y PC)...
netsh advfirewall firewall add rule name="Vortex ICMP" dir=in action=allow protocol=icmpv4:8,any >nul 2>&1
echo.

echo ===================================================================
echo   [LISTO!] Configurado correctamente.
echo   Ahora tu celular puede conectarse a:
echo   http://192.168.1.20:6767
echo ===================================================================
echo.
pause
