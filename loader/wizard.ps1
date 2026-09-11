$ErrorActionPreference = "Stop"
$VERSION = "1.0.1"
$HTTP = "https://raw.githubusercontent.com/r27006368-crypto/wizard-site/main/loader"
$APP = "Wizard"
$PF86 = [Environment]::GetFolderPath("ProgramFilesX86")
$CFG = Join-Path $PSScriptRoot "Wizard.ini"
$RES = Join-Path $PSScriptRoot "auth_result.txt"

function Get-WzHash([string]$s) {
  $s = "wz::" + $s
  $h = [uint64]0x811c9dc5
  foreach ($ch in $s.ToCharArray()) {
    $code = [int64][int][char]$ch
    $h = (($h -bxor $code) * [uint64]0x01000193) -band 0xFFFFFFFF
  }
  $digits = "0123456789abcdefghijklmnopqrstuvwxyz"
  $out = ""
  $n = [uint64]($h -band 0xFFFFFFFF)
  if ($n -eq 0) { $out = "0" }
  while ($n -gt 0) {
    $rem = [int]($n % 36)
    $out = $digits[$rem] + $out
    $n = [math]::Floor([double]$n / 36.0) -as [uint64]
  }
  while ($out.Length -lt 8) { $out += "0" }
  return $out
}

function Read-Ini {
  $r = @{}
  if (Test-Path -LiteralPath $CFG) {
    foreach ($line in Get-Content -LiteralPath $CFG) {
      if ($line -match '^\s*(\w+)\s*=\s*(.*?)\s*$') { $r[$matches[1]] = $matches[2] }
    }
  }
  if (-not $r.ContainsKey("ROOT") -or [string]::IsNullOrWhiteSpace($r["ROOT"])) { $r["ROOT"] = Join-Path $PF86 "Wizard" }
  if (-not $r.ContainsKey("RAM") -or [string]::IsNullOrWhiteSpace($r["RAM"])) { $r["RAM"] = "4" }
  return $r
}

function Write-Ini($cfg) {
  $c = "[Wizard]`r`nROOT=$($cfg['ROOT'])`r`nRAM=$($cfg['RAM'])`r`n"
  [System.IO.File]::WriteAllText($CFG, $c, (New-Object System.Text.UTF8Encoding($true)))
}

function Banner {
  $art = @(
    "    __        ___   _ __  ___   ____    ____   ____",
    "    \ \      / / \ | |  \/  | |  _ \  / ___| / ___|",
    "     \ \ /\ / / _ \| |\/\/| | | |_) | \___ \| |  _",
    "      \ V  V / ___ \ |  |  | | |  _ <   ___) | |_| |",
    "       \_/\_/_/   \_\_|  |_|_|_|_|_ \_\ |____/ \____|"
  )
  Clear-Host
  Write-Host ""
  foreach ($l in $art) { Write-Host $l -ForegroundColor Magenta }
  Write-Host "    ================================================" -ForegroundColor Cyan
  Write-Host "      Wizard 1.21.11  -  премиум клиент для Minecraft" -ForegroundColor Cyan
  Write-Host "      Версия лаунчера: $VERSION" -ForegroundColor DarkGray
  Write-Host ""
}

function Write-ErrLog($msg) {
  try {
    $log = Join-Path $PSScriptRoot "wizard_error.log"
    [System.IO.File]::AppendAllText($log, "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg`r`n", (New-Object System.Text.UTF8Encoding($true)))
  } catch {}
}

function Ensure-Elevated {
  $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object System.Security.Principal.WindowsPrincipal($id)
  $isAdmin = $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin -and ($cfg['ROOT'].StartsWith($PF86, [System.StringComparison]::OrdinalIgnoreCase))) {
    Write-Host ""
    Write-Host "Нужны права администратора, чтобы писать в $($cfg['ROOT'])." -ForegroundColor Yellow
    Write-Host "Сейчас откроется запрос UAC. Нажми Да." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    try {
      Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs -ErrorAction Stop | Out-Null
    } catch {
      Write-ErrLog "Elevate: $($_.Exception.Message)"
      Write-Host ""
      Write-Host "Запрос UAC не подтверждён или заблокирован." -ForegroundColor Red
      Write-Host "Без прав администратора лаунчер не сможет работать с папкой клиента." -ForegroundColor Yellow
      Read-Host "Нажми Enter, чтобы закрыть"
      exit 1
    }
    exit
  }
}

function Setup-Dirs {
  New-Item -ItemType Directory -Path $cfg['ROOT'] -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $cfg['ROOT'] "Minecraft") -Force | Out-Null
}

function Get-Sources {
  $list = @()
  $list += Join-Path $PSScriptRoot "1_21_11"
  $list += Join-Path ([Environment]::GetFolderPath("Desktop")) "1_21_11"
  $list += Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads\1_21_11"
  $list += Join-Path ([Environment]::GetFolderPath("Desktop")) "Site\1_21_11"
  return ($list | Where-Object { Test-Path -LiteralPath (Join-Path $_ "libraries") })
}

function Migrate-Client {
  $target = Join-Path $cfg['ROOT'] "Minecraft"
  $dst = Join-Path $target "1.21.11"
  if (Test-Path -LiteralPath (Join-Path $dst "libraries")) { return }
  foreach ($src in Get-Sources) {
    if (Test-Path -LiteralPath (Join-Path $src "libraries")) {
      Write-Host "Найдена папка 1_21_11: $src" -ForegroundColor Green
      try {
        Move-Item -LiteralPath $src -Destination $dst -Force -ErrorAction Stop
        Write-Host "Готово: $dst" -ForegroundColor Green
      } catch {
        Write-Host "Не удалось перенести папку: $($_.Exception.Message)" -ForegroundColor Red
      }
      return
    }
  }
}

function Rename-HighWay {
  Get-ChildItem -LiteralPath $cfg['ROOT'] -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'HighWay|highway' } |
    ForEach-Object {
      if ($_.Name -match 'HighWay') { $new = $_.Name -replace 'HighWay', 'Wizard' }
      else { $new = $_.Name -replace 'highway', 'wizard' }
      if ($new -ne $_.Name) {
        try { Rename-Item -LiteralPath $_.FullName -NewName $new -Force -ErrorAction Stop } catch {}
      }
    }
}

function Check-JavaRunning {
  $found = Get-Process -Name "java","javaw" -ErrorAction SilentlyContinue
  return $null -ne $found
}

function Get-RemoteVersion {
  try {
    $v = (Invoke-WebRequest -Uri "$HTTP/version.txt" -UseBasicParsing -TimeoutSec 8).Content.Trim()
    return $v
  } catch { return $null }
}

function Self-Update {
  $remote = Get-RemoteVersion
  if (-not $remote) { return }
  if ($remote -eq $VERSION) { return }
  Write-Host "Доступно обновление: $remote. Скачиваю..." -ForegroundColor Green
  try {
    $new = Join-Path $PSScriptRoot "wizard.new.ps1"
    (Invoke-WebRequest -Uri "$HTTP/wizard.ps1" -UseBasicParsing -TimeoutSec 20).Content | Out-File -LiteralPath $new -Encoding UTF8
    if (-not (Test-Path -LiteralPath $new)) { Write-Host "Ошибка скачивания." -ForegroundColor Red; return }
    $dv = @"
@echo off
ping 127.0.0.1 -n 3 >nul
move /y "`"$new`"" "`"$PSScriptRoot\wizard.ps1`"" >nul
start "" powershell -NoProfile -ExecutionPolicy Bypass -File "`"$PSScriptRoot\wizard.ps1`""
del "%~f0"
"@
    $upd = Join-Path $env:TEMP "wz_apply.cmd"
    [System.IO.File]::WriteAllText($upd, $dv, (New-Object System.Text.UTF8Encoding($true)))
    Start-Process -FilePath $upd
    exit
  } catch {
    Write-Host "Ошибка обновления: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Check-Auth {
  if ($script:Nick) { return $true }
  $user = Read-Host "Логин"
  $user = ($user -replace '\s', '')
  if (-not $user) { return $false }
  $sec = Read-Host -AsSecureString "Пароль"
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $pass = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  $hashed = Get-WzHash $pass
  try {
    $apikey = "sb_publishable_ljeSBj5cb5kfnuIaxyd_TQ_14RXJxFN"
    $base = "https://bxmxlxgwfdqiabsfbtrr.supabase.co"
    $enc = [uri]::EscapeDataString($user)
    $url = "$base/rest/v1/accounts?select=nick,pass,role,sub_forever,sub_to&nick=eq.$enc"
    $headers = @{ apikey = $apikey; Authorization = "Bearer $apikey"; Accept = "application/json" }
    $rows = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -TimeoutSec 25
    if (-not $rows -or @($rows).Count -eq 0) {
      Write-Host "Аккаунт не найден. Попробуй ещё раз." -ForegroundColor Red
      Start-Sleep -Seconds 2
      return $false
    }
    $u = @($rows)[0]
    if ([string]$u.pass -ne $hashed) {
      Write-Host "Неверный пароль." -ForegroundColor Red
      Start-Sleep -Seconds 2
      return $false
    }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $forever = $false
    if ($u.sub_forever) { $forever = $true }
    $sub = $false
    if ($u.sub_to) {
      try { $t = [int64]$u.sub_to } catch { $t = [int64]0 }
      if ($t -gt $now) { $sub = $true }
    }
    $script:SubOk = ($forever -or $sub)
    $script:Nick = [string]$u.nick
    $script:Role = "User"
    if ($u.role) { $script:Role = [string]$u.role }
    return $true
  } catch {
    Write-Host "Ошибка проверки: невозможно связаться с базой. Проверь интернет/VPN." -ForegroundColor Red
    Start-Sleep -Seconds 3
    return $false
  }
}

function Make-SessionJson {
  $rand = [guid]::NewGuid().ToString()
  $game = Join-Path $script:MC "game"
  if (-not (Test-Path -LiteralPath $game)) { $game = $script:MC }
  $json = "{`n  `"accessToken`": `"0`",`n  `"clientToken`": `"wizard`",`n  `"selectedProfile`": {`n    `"id`": `"$rand`",`n    `"name`": `"$($script:Nick)`",`n    `"userId`": `"$rand`"`n  }`n}`n"
  [System.IO.File]::WriteAllText((Join-Path $game "session.json"), $json, (New-Object System.Text.UTF8Encoding($true)))
}

function Launch-Client {
  $script:MC = Join-Path $cfg['ROOT'] "Minecraft\1.21.11"
  $libs = Join-Path $script:MC "libraries"
  if (-not (Test-Path -LiteralPath $libs)) {
    Write-Host "Файлы клиента не найдены или папка занята." -ForegroundColor Red
    Write-Host "Настрой корневую папку (пункт 2) или запусти перенос 1_21_11." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    return
  }
  if (Check-JavaRunning) {
    Write-Host "Папка клиента используется - уже запущен Java-процесс (Minecraft)." -ForegroundColor Red
    Write-Host "Закрой игру и попробуй снова." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    return
  }
  $java = Join-Path $script:MC "runtime\bin\java.exe"
  if (-not (Test-Path -LiteralPath $java)) { $java = Join-Path $script:MC "runtime\bin\javaw.exe" }
  if (-not (Test-Path -LiteralPath $java)) { $java = "javaw" }
  Make-SessionJson
  $game = Join-Path $script:MC "game"
  $native = Join-Path $script:MC "natives"
  Write-Host "Запуск клиента 1.21.11 для $($script:Nick) с $($cfg['RAM']) ГБ ОЗУ..." -ForegroundColor Green
  $args = @(
    "-Xms$($cfg['RAM'])G", "-Xmx$($cfg['RAM'])G",
    "-Djava.library.path=`"$native`"",
    "-cp", "`"$(Join-Path $script:MC 'libraries\*')`"",
    "net.fabricmc.loader.impl.launch.knot.KnotClient",
    "--version", "1.21.11", "--gameDir", "`"$game`"", "--assetsDir", "`"$(Join-Path $game 'assets')`"",
    "--assetIndex", "29", "--username", $script:Nick, "--uuid", ([guid]::NewGuid().ToString()), "--accessToken", "0"
  )
  try { Start-Process -FilePath $java -ArgumentList $args -WorkingDirectory $script:MC } catch {
    Write-Host "Не удалось запустить Java: $($_.Exception.Message)" -ForegroundColor Red
    Start-Sleep -Seconds 3
  }
}

function Root-Menu {
  while ($true) {
    Clear-Host
    Banner
    Write-Host "  === Корневая папка клиента ===" -ForegroundColor Cyan
    Write-Host "  Текущая: $($cfg['ROOT'])" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "   1. Открыть папку клиента в Проводнике"
    Write-Host "   2. Указать другую папку вручную"
    Write-Host "   3. Автоматический перенос 1_21_11 (Рабочий стол/Загрузки)"
    Write-Host "   4. Назад"
    Write-Host ""
    $c = Read-Host "  Выбери пункт"
    switch ($c) {
      "1" {
        $mc = Join-Path $cfg['ROOT'] "Minecraft\1.21.11"
        if (Test-Path -LiteralPath $mc) { Start-Process explorer.exe -ArgumentList "`"$mc`"" } else { Start-Process explorer.exe -ArgumentList "`"$($cfg['ROOT'])`"" }
        Write-Host "Открываю папку. Можешь переместить её куда угодно." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
      }
      "2" {
        $new = Read-Host "Путь к корневой папке"
        if ($new -and (Test-Path -LiteralPath $new)) {
          $cfg['ROOT'] = $new
          Setup-Dirs
          Write-Ini $cfg
          Write-Host "Корневая папка обновлена." -ForegroundColor Green
          Start-Sleep -Seconds 2
        } else {
          Write-Host "Путь не существует." -ForegroundColor Red
          Start-Sleep -Seconds 2
        }
      }
      "3" {
        Setup-Dirs
        Migrate-Client
        Rename-HighWay
        Write-Host "Готово." -ForegroundColor Green
        Start-Sleep -Seconds 2
      }
      "4" { return }
    }
  }
}

function Ram-Menu {
  Clear-Host
  Banner
  Write-Host "  === Параметры ОЗУ ===" -ForegroundColor Cyan
  Write-Host "  Сейчас выделяется: $($cfg['RAM']) ГБ" -ForegroundColor Green
  Write-Host "  Больше ОЗУ = выше FPS, но нельзя давать больше свободной памяти ПК." -ForegroundColor Yellow
  Write-Host ""
  $new = Read-Host "Сколько ГБ выделить (2-16)"
  $n = 0
  if ([int]::TryParse($new, [ref]$n) -and $n -ge 2 -and $n -le 16) {
    $cfg['RAM'] = [string]$n
    Write-Ini $cfg
    Write-Host "ОЗУ установлено: $n ГБ" -ForegroundColor Green
  } else {
    Write-Host "Ошибка: введи целое число от 2 до 16." -ForegroundColor Red
  }
  Start-Sleep -Seconds 2
}

try {
  $cfg = Read-Ini
  Ensure-Elevated
  Setup-Dirs
  Migrate-Client
  Rename-HighWay
  Self-Update

  while ($true) {
    Banner
    if (-not $script:Nick) {
      if (-not (Check-Auth)) { continue }
    }
    Banner
    Write-Host "  Добро пожаловать, $($script:Nick)   Роль: $($script:Role)" -ForegroundColor White
    if ($script:SubOk) { Write-Host "  Подписка: активна" -ForegroundColor Green }
    else { Write-Host "  Подписка: не активна / истекла" -ForegroundColor Red }
    Write-Host ""
    Write-Host "   1. Запуск клиента"
    Write-Host "   2. Изменить корневую папку клиента"
    Write-Host "   3. Изменить параметры ОЗУ (сейчас: $($cfg['RAM']) ГБ)"
    Write-Host "   4. Выход"
    Write-Host ""
    $c = Read-Host "  Выбери пункт"
    switch ($c) {
      "1" { Launch-Client; Start-Sleep -Seconds 5; continue }
      "2" { Root-Menu }
      "3" { Ram-Menu }
      "4" { exit }
      default { }
    }
  }
} catch {
  Write-ErrLog $_.Exception.ToString()
  Write-Host ""
  Write-Host "Произошла ошибка:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host "Подробности сохранены в wizard_error.log рядом с лаунчером." -ForegroundColor Yellow
  Write-Host "Сообщи это сообщение в поддержку." -ForegroundColor Yellow
  Read-Host "Нажми Enter, чтобы закрыть"
  exit 1
}