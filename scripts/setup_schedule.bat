@echo off
SET SCRIPT_PATH=c:\Users\Pedro Neto\Desktop\APLICATIVOS\GupyMesa\gupymesa\scripts\automation.js
SET WORK_DIR=c:\Users\Pedro Neto\Desktop\APLICATIVOS\GupyMesa\gupymesa
SET LOG_PATH=c:\Users\Pedro Neto\Desktop\APLICATIVOS\GupyMesa\gupymesa\automation_log.txt

echo [INFO] Configurando Tarefa Agendada para as 05:00 diariamente...

:: Cria o arquivo .bat que sera executado pela tarefa
echo @echo off > "%WORK_DIR%\run_automation.bat"
echo cd /d "%WORK_DIR%" >> "%WORK_DIR%\run_automation.bat"
echo node scripts\automation.js >> "%LOG_PATH%" 2>&1 >> "%WORK_DIR%\run_automation.bat"

:: Agenda a tarefa no Windows
schtasks /create /tn "GupyMesaAutoImport" /tr "\"%WORK_DIR%\run_automation.bat\"" /sc daily /st 05:00 /f

echo [SUCCESS] Tarefa "GupyMesaAutoImport" agendada com sucesso!
echo [INFO] O log sera salvo em: %LOG_PATH%
pause
