@echo off
title An Tam - Start LAN
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\lan\start-lan.ps1" %*
set "RESULT=%ERRORLEVEL%"
if errorlevel 1 (
  echo.
  echo Startup failed. Read the message above, then retry.
)
echo.
pause
exit /b %RESULT%
