@echo off
echo ===================================================
echo   GupyMesa - TiDB Auto Migration Tool
echo ===================================================
echo.

if not exist .env (
    echo [ERRO] Arquivo .env nao encontrado!
    echo Copie .env.example para .env e configure suas credenciais do TiDB.
    pause
    exit /b
)

echo [INFO] Executando migracoes...
node scripts/migrate.js

if %errorlevel% equ 0 (
    echo.
    echo [SUCESSO] Banco de dados atualizado!
) else (
    echo.
    echo [ERRO] Falha na migracao. Verifique os logs acima.
)

pause
