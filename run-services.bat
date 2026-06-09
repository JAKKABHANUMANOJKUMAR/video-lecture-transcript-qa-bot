@echo off
REM Double-click this file to start all services (calls run-services.ps1)
powershell -ExecutionPolicy Bypass -File "%~dp0run-services.ps1"
pause
