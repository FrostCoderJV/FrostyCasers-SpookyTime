@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM Перезапускает проект при любом завершении node (OOM, ошибка, ручной exit, и т.д.)
REM Остановить: Ctrl+C

REM Постоянный лимит heap для V8 (16 ГБ) для этого проекта.
set NODE_OPTIONS=--max-old-space-size=16384

set SLEEP_SECONDS=5

:loop
echo [%date% %time%] starting: node main.js
node .\main.js
set CODE=%errorlevel%
echo [%date% %time%] exited: code=%CODE% ^| restart in %SLEEP_SECONDS%s
timeout /t %SLEEP_SECONDS% /nobreak >nul
goto loop

