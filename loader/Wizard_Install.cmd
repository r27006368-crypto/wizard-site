@echo off
chcp 65001 >nul
title Wizard Installer
set "APP=%ProgramFiles(x86)%\Wizard"

net session >nul 2>&1
if errorlevel 1 (
  if not exist "%APP%" (
    echo Установка требует прав администратора. Открываю запрос UAC...
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
  echo Ошибка копирования.
  pause
  exit /b
)
echo.
echo  Лаунчер установлен в:
echo    %APP%
echo.
echo  Запускаю лаунчер...
start "" "%APP%\Wizard.cmd"