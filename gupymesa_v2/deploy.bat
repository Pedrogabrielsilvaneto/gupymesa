@echo off
echo ===================================================
echo   GupyMesa - Auto Deploy Tool (Vercel)
echo ===================================================
echo.

:: 1. Verifica se o Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado! Instale o Node.js para continuar.
    pause
    exit /b
)

:: 2. Verifica se o Vercel CLI esta instalado
call vercel --version >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Vercel CLI nao encontrada. Instalando...
    call npm install -g vercel
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao instalar Vercel CLI via npm.
        echo Tente rodar este script como Administrador ou instale manualmente: npm install -g vercel
        pause
        exit /b
    )
)

:: 3. Executa o Deploy
echo.
echo [INFO] Iniciando Deploy para Vercel (Producao)...
echo.

:: O comando 'vercel --prod' fara o deploy. 
:: Se for a primeira vez, ele pedira login/link interativo.
call vercel --prod --yes

if %errorlevel% equ 0 (
    echo.
    echo [SUCESSO] Deploy concluido!
) else (
    echo.
    echo [ERRO] Ocorreu um erro durante o deploy.
)

pause
