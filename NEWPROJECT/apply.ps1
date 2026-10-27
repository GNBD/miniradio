# NEWPROJECT -> firmware apply script
#
#   powershell -ExecutionPolicy Bypass -File NEWPROJECT\apply.ps1 `
#       -Layout "$env:USERPROFILE\Downloads\ui_custom_layout.h" `
#       -Menu   "$env:USERPROFILE\Downloads\menu_data.c" `
#       -Mod    "$env:USERPROFILE\Downloads\mod_generated.h"
#
#   powershell -ExecutionPolicy Bypass -File NEWPROJECT\apply.ps1 -Off      # 커스텀 UI 끄기
#   powershell -ExecutionPolicy Bypass -File NEWPROJECT\apply.ps1 -OffMod   # 생성 모드 끄기
param(
    [string]$Layout = "",
    [string]$Menu = "",
    [string]$Settings = "",
    [string]$Mod = "",
    [string]$Port = "COM7",
    [switch]$Off,
    [switch]$OffMod
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$layoutDst = Join-Path $root "main\ui_custom_layout.h"
$menuDst = Join-Path $root "main\menu_data.c"
$settingsDst = Join-Path $root "main\settings_data.c"
$modDst = Join-Path $root "main\mod_generated.h"

$defaultLayout = @'
/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) miniradio Contributors
 *
 * Default (disabled) custom layout. NEWPROJECT exports ui_custom_layout.h
 * and overwrites this file.
 */
#pragma once

#include "ui_custom.h"

#define UI_CUSTOM_ENABLE 0

static const uc_widget_t uc_widgets[] = {
    { .type = UC_RECT },
};

#define UC_WIDGET_COUNT ((int)(sizeof(uc_widgets) / sizeof(uc_widget_t)))
'@

$defaultMod = @'
/*
 * SPDX-License-Identifier: MIT
 *
 * Default mod slot. MINI-radio Modder Studio overwrites this file with
 * mod_generated.h (MODS_ENABLE 1). KEEP THIS FILE BUILDABLE WITH MODS OFF.
 */
#pragma once

#define MODS_ENABLE 0
#define MOD_PROJECT_NAME "builtin"
#define MOD_PROJECT_VERSION "0"
'@

function Backup($path) {
    if (Test-Path $path) {
        Copy-Item $path "$path.bak" -Force
    }
}

function Build-Flash {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    . C:\esp\esp-idf\export.ps1 | Out-Null
    Push-Location $root
    try {
        idf.py build
        if ($LASTEXITCODE -ne 0) { throw "build failed" }
        $bin = Join-Path $root "build\miniradio.bin"
        if (-not (Test-Path $bin)) { throw "app image not found: $bin" }

        # 버전이 붙은 OTA 파일명으로 보관한 뒤 그 파일을 기록한다.
        $ver = "dev"
        $cm = Join-Path $root "CMakeLists.txt"
        $m = Select-String -Path $cm -Pattern 'set\(PROJECT_VER\s+"([^"]+)"\)' | Select-Object -First 1
        if ($m) { $ver = $m.Matches[0].Groups[1].Value }
        $safe = ($ver -replace '\s+', '_')
        $named = Join-Path $root ("build\GNBD_miniradio_" + $safe + "_ota.bin")
        Copy-Item $bin $named -Force
        Write-Host ("image: " + $named)

        python -m esptool --chip esp32s3 -p $Port -b 460800 write_flash 0x10000 $named
        if ($LASTEXITCODE -ne 0) { throw "flash failed" }
    } finally {
        Pop-Location
    }
}

if ($Off) {
    Backup $layoutDst
    Set-Content -Path $layoutDst -Value $defaultLayout -Encoding UTF8
    Write-Host "custom UI disabled -> rebuilding"
    Build-Flash
    exit 0
}

if ($OffMod) {
    Backup $modDst
    Set-Content -Path $modDst -Value $defaultMod -Encoding UTF8
    Write-Host "generated mods disabled -> rebuilding"
    Build-Flash
    exit 0
}

$applied = @()
if ($Layout) {
    if (-not (Test-Path $Layout)) { Write-Host "layout not found: $Layout"; exit 1 }
    Backup $layoutDst
    Copy-Item $Layout $layoutDst -Force
    $applied += "layout"
}
if ($Menu) {
    if (-not (Test-Path $Menu)) { Write-Host "menu not found: $Menu"; exit 1 }
    Backup $menuDst
    Copy-Item $Menu $menuDst -Force
    $applied += "menu"
}
if ($Settings) {
    if (-not (Test-Path $Settings)) { Write-Host "settings not found: $Settings"; exit 1 }
    Backup $settingsDst
    Copy-Item $Settings $settingsDst -Force
    $applied += "settings"
}
if ($Mod) {
    if (-not (Test-Path $Mod)) { Write-Host "mod not found: $Mod"; exit 1 }
    Backup $modDst
    Copy-Item $Mod $modDst -Force
    $applied += "mod"
}
if (-not $applied.Count) {
    Write-Host "nothing to apply. Use -Layout/-Menu/-Settings/-Mod <file>, or -Off."
    exit 1
}

Write-Host ("applied: " + ($applied -join ", "))
Build-Flash
Write-Host "done"
