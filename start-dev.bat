@echo off
setlocal

cd /d "%~dp0"

start "Inventory Dev Server" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start "" chrome "http://localhost:3000"
