$ErrorActionPreference = "Stop"

$target = if ($env:TAURI_WIN_TARGET) { $env:TAURI_WIN_TARGET } else { "x86_64-pc-windows-msvc" }

Write-Host "[tauri:build:win] Building static frontend for Tauri..."
npm run build:tauri

Write-Host "[tauri:build:win] Building Tauri bundle for target $target..."
npx tauri build --target $target

Write-Host "[tauri:build:win] Build finished."
