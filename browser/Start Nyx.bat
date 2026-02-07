@echo off
title Nyx Music Server

:: 1. Start the Backend in the background (Hidden)
start /min cmd /c "cd /d D:\My Projects\nyx\backend && npm run dev"

:: 2. Wait 5 seconds for the server to wake up
timeout /t 5 /nobreak >nul

:: 3. Open the Frontend in your default browser (Chrome/Edge)
:: (Assuming your frontend runs on localhost:3000)
start http://localhost:3000

:: Optional: Minimizes this launcher window
exit