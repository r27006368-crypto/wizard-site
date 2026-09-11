@echo off
chcp 65001 >nul
title Wizard Installer
set "APP=%ProgramFiles(x86)%\Wizard"

net session >nul 2>&1
if errorlevel 1 (
  if not exist "%APP%" (
    echo Setup requires administrator rights. Opening UAC prompt...
    timeout /t 1 >nul
    powershell -NoProfile -Command "Start-Process -FilePath '%ComSpec%' -ArgumentList '/c','\"%~f0\"' -Verb RunAs" >nul 2>&1
    exit /b
  )
)

md "%APP%" 2>nul
copy /y "%~dp0Wizard.cmd" "%APP%\Wizard.cmd" >nul
copy /y "%~dp0wizard.ps1" "%APP%\wizard.ps1" >nul
if exist "%~dp0Wizard.ini" copy /y "%~dp0Wizard.ini" "%APP%\Wizard.ini" >nul
if not exist "%APP%\wizard.ps1" (
  echo Copy failed.
  pause
  exit /b
)
echo.
echo  Launcher installed to:
echo    %APP%
echo.
echo  Starting launcher...
start "" "%APP%\Wizard.cmd"