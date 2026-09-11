@echo off
title Wizard Launcher

net session >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs" >nul 2>&1
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wizard.ps1"