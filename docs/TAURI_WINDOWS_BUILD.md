# Tauri Windows Build Guide

This guide builds VFDashboard desktop app on a Windows machine (native build, no cross-compile from macOS).

## 1) Prerequisites (Windows)

- Windows 10/11 (x64)
- Node.js 22+
- Rust toolchain (stable, MSVC target)
- Microsoft C++ Build Tools (Desktop development with C++)
- WebView2 Runtime (usually preinstalled on Windows 11)

Install commands (PowerShell):

```powershell
winget install OpenJS.NodeJS.LTS
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools
winget install Microsoft.EdgeWebView2Runtime
```

After Rust install, ensure target exists:

```powershell
rustup default stable-x86_64-pc-windows-msvc
rustup target add x86_64-pc-windows-msvc
```

## 2) Get source code

```powershell
git clone https://github.com/VF9-Club/VFDashboard.git
cd VFDashboard
```

## 3) Install dependencies

```powershell
npm install
```

## 4) Build Windows desktop package (recommended)

```powershell
npm run tauri:build:win
```

This command runs both phases in order:

1. `npm run build:tauri`
2. `npx tauri build --target x86_64-pc-windows-msvc`

## 5) Optional: PowerShell script variant

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-tauri-win.ps1
```

## 6) Output artifacts

Look under:

- `src-tauri/target/release/bundle/`

Common outputs:

- `nsis/` (installer `.exe`)
- `msi/` (Windows Installer package)

## 6.1) Upload Windows build to existing GitHub Release

After build finishes, upload Windows artifacts to the same release tag:

```powershell
gh auth login
gh release upload v1.0.0 `
  .\src-tauri\target\release\bundle\nsis\*.exe `
  .\src-tauri\target\release\bundle\msi\*.msi `
  --clobber
```

If this is a new version, create a new tag/release first:

```powershell
gh release create v1.0.1 --draft --title "VFDashboard 1.0.1"
```

## 7) Optional: quick dev run on Windows

```powershell
npm run tauri:dev
```

## Troubleshooting

- **`link.exe` / MSVC errors**: open `Visual Studio Installer` and add `Desktop development with C++` workload.
- **WebView2 missing**: install `Microsoft Edge WebView2 Runtime`.
- **Rust target mismatch**: run `rustup default stable-x86_64-pc-windows-msvc`.
- **Node version too low**: use Node 22+.
