@echo off
title An Tam - Stop project
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\lan\stop-lan.ps1"
set "RESULT=%ERRORLEVEL%"
if errorlevel 1 (
  echo.
  echo Stop failed. Read the message above.
)
echo.
pause
exit /b %RESULT%
