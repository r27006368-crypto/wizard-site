@echo off
chcp 65001 >nul
title Wizard Launcher
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wizard.ps1"