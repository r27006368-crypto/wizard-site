$ErrorActionPreference = "Stop"
$VERSION = "1.0.8"
$HTTP = "https://raw.githubusercontent.com/r27006368-crypto/wizard-site/main/loader"
$APP = "Wizard"
$PF86 = [Environment]::GetFolderPath("ProgramFilesX86")
$CFG = Join-Path $PSScriptRoot "Wizard.ini"
$RES = Join-Path $PSScriptRoot "auth_result.txt"

function Get-WzHash([string]$s) {
  $s = "wz::" + $s
  $h = [uint64]2166136261
  foreach ($ch in $s.ToCharArray()) {
    $code = [int64][int][char]$ch
    $h = (($h -bxor $code) * [uint64]16777619) -band [uint64]4294967295
  }
  $digits = "0123456789abcdefghijklmnopqrstuvwxyz"
  $out = ""
  $n = [uint64]($h -band [uint64]4294967295)
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
    "__        __  _  _____     _      ____     ____",
    "\ \      / / (_)   / /    / \     |  _ \   |  _ \",
    " \ \ /\ / /  | |  / /    / _ \    | |_) |  | | | |",
    "  \ V  V /   | | / /    / ___ \   |  _ <   | |_| |",
    "   \_/\_/    |_| /_/    /_/   \_\ |_| \_\  |____/"
  )
  $w = 80
  try { $sw = $Host.UI.RawUI.WindowSize.Width; if ($sw -ge 60) { $w = $sw } } catch {}
  function Pad-C([string]$s) {
    $pad = [Math]::Max(0, $w - $s.Length - 6)
    $ind = [Math]::Floor($pad / 2)
    return (" " * $ind) + $s + (" " * ($pad - $ind + 3))
  }
  Clear-Host
  Write-Host ""
  foreach ($l in $art) { Write-Host (Pad-C $l) -ForegroundColor Magenta }
  $sep = "=" * ([Math]::Max(20, $w - 4))
  Write-Host (Pad-C $sep) -ForegroundColor Cyan
  Write-Host (Pad-C "Wizard 1.21.11  |  premium Minecraft client") -ForegroundColor Cyan
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
    Write-Host "Запусти Wizard.cmd от имени администратора: правый клик -> 'Запуск от имени администратора'." -ForegroundColor Yellow
    Read-Host "Нажми Enter, чтобы закрыть"
    exit 1
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

function Test-ProtectedLoader([string]$loader) {
  if (-not (Test-Path -LiteralPath $loader)) { return $false }
  try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($loader)
    try {
      $entry = $zip.Entries | Where-Object { $_.FullName -eq 'net/fabricmc/loader/impl/launch/knot/KnotClient.class' } | Select-Object -First 1
      if (-not $entry) { return $false }
      $s = $entry.Open()
      try {
        $b = New-Object byte[] 4
        $s.Read($b, 0, 4) | Out-Null
        return ($b[0] -eq 0xDE -and $b[1] -eq 0xAD)
      } finally { $s.Dispose() }
    } finally { $zip.Dispose() }
  } catch { return $false }
}

function Repair-ProtectedLoader {
  $loader = Join-Path $script:MC "libraries\fabric-loader-0.19.3.jar"
  if (-not (Test-Path -LiteralPath $loader)) { return }
  if (-not (Test-ProtectedLoader $loader)) { return }
  Write-Host "Обнаружен защищённый fabric-loader (HighWay). Меняю на официальный..." -ForegroundColor Yellow
  $bakDir = Join-Path $cfg['ROOT'] "backup"
  New-Item -ItemType Directory -Path $bakDir -Force | Out-Null
  $bak = Join-Path $bakDir "fabric-loader-0.19.3.protected.jar"
  $dl = Join-Path $env:TEMP "fabric-loader-0.19.3.official.jar"
  try {
    Move-Item -LiteralPath $loader -Destination $bak -Force -ErrorAction Stop
    Invoke-WebRequest -Uri "https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.19.3/fabric-loader-0.19.3.jar" -OutFile $dl -UseBasicParsing -TimeoutSec 60 -ErrorAction Stop
    Copy-Item -LiteralPath $dl -Destination $loader -Force -ErrorAction Stop
    if (Test-ProtectedLoader $loader) { throw "Файл всё ещё защищён" }
    Write-Host "Готово: fabric-loader заменён на официальный." -ForegroundColor Green
  } catch {
    if (-not (Test-Path -LiteralPath $loader) -and (Test-Path -LiteralPath $bak)) { Copy-Item -LiteralPath $bak -Destination $loader -Force }
    Write-Host "Не удалось заменить loader: $($_.Exception.Message)" -ForegroundColor Red
    Write-ErrLog "RepairLoader: $($_.Exception.ToString())"
  }
}

function Check-JavaRunning {
  $found = Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "KnotClient" }
  return $null -ne $found
}

function Stop-StaleJava {
  Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match "KnotClient" } |
    ForEach-Object {
      try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop | Out-Null } catch {}
    }
}

function Get-JavaMajor([string]$path) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $v = (& $path -version 2>&1 | Out-String)
  } catch { $ErrorActionPreference = $old; return 0 }
  $ErrorActionPreference = $old
  if ($v -match 'version "(\d+)') { return [int][int]$matches[1] }
  return 0
}

function Find-Java {
  $cands = New-Object System.Collections.Generic.List[string]
  if ($env:JAVA_HOME) {
    $p = Join-Path $env:JAVA_HOME "bin\java.exe"
    if (Test-Path -LiteralPath $p) { $cands.Add($p) }
  }
  $cmd = Get-Command java -ErrorAction SilentlyContinue
  if ($cmd) { $cands.Add($cmd.Source) }
  $cmdw = Get-Command javaw -ErrorAction SilentlyContinue
  if ($cmdw) { $cands.Add($cmdw.Source) }
  foreach ($p in @(
    (Join-Path $script:MC "runtime\bin\java.exe"),
    (Join-Path $script:MC "runtime\bin\javaw.exe")
  )) { if ($p -and (Test-Path -LiteralPath $p)) { $cands.Add($p) } }
  $roots = @(
    (Get-ChildItem -LiteralPath (Join-Path $script:MC "runtime") -Recurse -Filter java.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName),
    (Get-ChildItem -Path "C:\Program Files\Java" -Recurse -Filter java.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName),
    (Get-ChildItem -Path "C:\Program Files\Eclipse Adoptium" -Recurse -Filter java.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName),
    (Get-ChildItem -Path "C:\Program Files\JetBrains" -Recurse -Filter java.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName),
    (Get-ChildItem -Path "$env:LOCALAPPDATA\Programs" -Recurse -Filter java.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
  )
  foreach ($list in $roots) { foreach ($p in $list) { if ($p -and (Test-Path -LiteralPath $p)) { $cands.Add($p) } } }
  foreach ($p in ($cands | Select-Object -Unique)) {
    if ((Get-JavaMajor $p) -ge 21) { return $p }
  }
  return $null
}

function Get-RemoteVersion {
  try {
    $v = (Invoke-WebRequest -Uri "$HTTP/version.txt" -UseBasicParsing -TimeoutSec 8).Content.Trim()
    return $v
  } catch { return $null }
}

function Get-VersionNum([string]$s) {
  $p = @($s -split '\.')
  $a = 0; $b = 0; $c = 0
  if ($p.Length -gt 0) { [int]::TryParse($p[0], [ref]$a) | Out-Null }
  if ($p.Length -gt 1) { [int]::TryParse($p[1], [ref]$b) | Out-Null }
  if ($p.Length -gt 2) { [int]::TryParse($p[2], [ref]$c) | Out-Null }
  return ($a * 1000000 + $b * 1000 + $c)
}

function Self-Update {
  $remote = Get-RemoteVersion
  if (-not $remote) { return }
  if ((Get-VersionNum $remote) -le (Get-VersionNum $VERSION)) { return }
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
    Write-Host "В фоне найден зависший процесс Minecraft (KnotClient)." -ForegroundColor Yellow
    $k = Read-Host "Закрыть его и запустить заново? (y/n)"
    if ($k -match '^(y|д|yes|да|1)$') {
      Stop-StaleJava
      Start-Sleep -Seconds 2
    } else {
      Write-Host "Отменено." -ForegroundColor Yellow
      Start-Sleep -Seconds 1
      return
    }
  }
  Repair-ProtectedLoader
  $java = Find-Java
  if (-not $java) {
    Write-Host "Java 21 не найдена." -ForegroundColor Red
    Write-Host "Установи Temurin JDK 21+ или положи рабочую java.exe в runtime\bin внутри клиента." -ForegroundColor Yellow
    Start-Sleep -Seconds 4
    return
  }
  $jmaj = Get-JavaMajor $java
  Make-SessionJson
  $game = Join-Path $script:MC "game"
  if (-not (Test-Path -LiteralPath $game)) { $game = $script:MC }
  $native = Join-Path $script:MC "natives"
  $wild = Join-Path $script:MC "libraries\*"
  $uuid = [guid]::NewGuid().ToString()
  Write-Host "Запуск клиента 1.21.11 для $($script:Nick) с $($cfg['RAM']) ГБ ОЗУ..." -ForegroundColor Green
  Write-Host "Java: $java (версия $jmaj)" -ForegroundColor DarkGray
  $argStr = '"-Xms' + $cfg['RAM'] + 'G" "-Xmx' + $cfg['RAM'] + 'G" -Djava.library.path="' + $native + '" -cp "' + $wild + '" net.fabricmc.loader.impl.launch.knot.KnotClient --version 1.21.11 --gameDir "' + $game + '" --assetsDir "' + (Join-Path $game "assets") + '" --assetIndex 29 --username "' + $script:Nick + '" --uuid "' + $uuid + '" --accessToken "0"'
  $stdout = Join-Path $script:MC "client_out.log"
  $stderr = Join-Path $script:MC "client_err.log"
  try {
    Start-Process -FilePath $java -ArgumentList $argStr -WorkingDirectory $script:MC -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    Write-Host "Клиент запущен." -ForegroundColor Green
    Start-Sleep -Seconds 2
    exit
  } catch {
    Write-Host "Не удалось запустить Java: $($_.Exception.Message)" -ForegroundColor Red
    Write-ErrLog "Launch: $($_.Exception.ToString())"
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