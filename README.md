# VinFast Dashboard — VF9 Club Edition

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/Node.js-22%2B-green)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

Open-source "Digital Twin" dashboard for VinFast EVs — real-time telemetry via MQTT, cross-platform native apps via Tauri.

---

> ### 🇻🇳 Thông tin dành cho người dùng Việt Nam
>
> - **Vui lòng cảnh giác với website/app giả mạo.** Không đăng nhập tài khoản VinFast trên các website lạ hoặc ứng dụng tải từ nguồn không tin cậy.
> - **Chỉ sử dụng khi bạn tự đánh giá là tin tưởng và chấp nhận rủi ro.** Đây là dự án cộng đồng, không phải sản phẩm chính thức của VinFast.
> - **Website chính thức của dự án:** ~~[**dashboard.vf9.club**](https://dashboard.vf9.club)~~ _(tạm thời chưa truy cập được, đang chờ review lại)_.
> - **Cam kết minh bạch:** mọi bản build phát hành đều dựa trên source code public trong repository này.
>
> **Tải bản phát hành v1.0.0:**
>
> [![Download macOS](<https://img.shields.io/badge/Download-macOS%20(Apple%20Silicon)-111111?style=for-the-badge&logo=apple>)](https://github.com/VF9-Club/VFDashboard/releases/download/v1.0.0/VFDashboard_1.0.0_aarch64.dmg)
> [![Download Windows](https://img.shields.io/badge/Download-Windows%20x64-0078D6?style=for-the-badge&logo=windows)](https://github.com/VF9-Club/VFDashboard/releases/download/v1.0.0/VFDashboard_1.0.0_x64.exe)
> [![Download Android](https://img.shields.io/badge/Download-Android%20APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/VF9-Club/VFDashboard/releases/download/v1.0.0/VFDashboard_1.0.0_aarch64_signed.apk)
>
> Thảo luận thêm về dự án: [**ANH EM VF9 — VF9 CLUB**](https://www.facebook.com/groups/706124277686588/)
>
> _📄 English documentation below._

---

## 📸 Screenshots

### Desktop / Tablet

![Dashboard Preview](docs/assets/dashboard_preview.webp)

### Mobile

<table><tr>
  <td><img src="public/mobile-vf3.webp" alt="Mobile Dashboard — VF3" width="280" /></td>
  <td><img src="public/mobile-vf9-energy.webp" alt="Mobile Dashboard — VF9 Energy" width="280" /></td>
  <td><img src="public/mobile-vf3-charging.webp" alt="Mobile — VF3 Charging History" width="280" /></td>
</tr></table>

## ✨ Features

- **Digital Twin Visualizer** — Accurate representation of vehicle status including doors, locks, and tires.
- **Real-time Telemetry via MQTT** — Live streaming of Battery SOC, Range, Speed, Charging status via AWS IoT Core WebSocket. First data arrives ~500ms after connect.
- **Mobile-First Experience** — Optimized for phone screens with zero scrollbars, fixed viewports, and touch-friendly layouts.
- **Safety Monitor** — Integrated alerts for Tire Pressure (TPMS), Door Ajar, and Intrusion.
- **Multi-Vehicle Support** — Instant switching between vehicles with cached telemetry.
- **Charging History** — Full session history with smart filtering.
- **Deep Scan** — Progressive telemetry viewer with crowdsourced KV aliases.
- **Cross-Platform Native Apps** — Desktop (macOS, Windows) and Mobile (Android, iOS) via Tauri 2.
- **X-HASH + X-HASH-2** — Dual-layer API signing on all protected endpoints.

## 🛠 Tech Stack

| Layer           | Technology                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| **Frontend**    | Astro 5, React, Tailwind CSS, Nanostores                                   |
| **Backend**     | Serverless Proxy (Astro SSR on Cloudflare Pages), multi-proxy 429 failover |
| **Telemetry**   | MQTT over WebSocket (AWS IoT Core) — real-time, no polling                 |
| **Auth**        | Auth0 OAuth2, HttpOnly cookies (auto-detects localhost for local dev)      |
| **Storage**     | Cloudflare KV (crowdsourced telemetry aliases)                             |
| **Native Apps** | Tauri 2 (Rust) — macOS, Windows, Android, iOS                              |

## 🏗 System Architecture

![System Architecture](docs/assets/system-architecture.svg)

## 🚀 Quick Start

### Prerequisites

- Node.js v22+
- A VinFast Connected Car Account

### Install & Run

```bash
git clone https://github.com/VF9-Club/VFDashboard.git
cd VFDashboard
npm install
npm run dev
```

Dashboard opens at `http://localhost:4321`.

## 📦 Native Builds (Tauri)

VFDashboard ships as a native app on all major platforms via [Tauri 2](https://v2.tauri.app/).

### Common Prerequisites

- Node.js v22+
- Rust toolchain (stable) — [install](https://rustup.rs/)
- Tauri CLI (bundled via `@tauri-apps/cli` in devDependencies)

### macOS (Apple Silicon / Intel)

```bash
# Install Xcode Command Line Tools (if not already)
xcode-select --install

# Build
npm install
npm run tauri build

# Or target a specific architecture
npm run tauri build -- --target aarch64-apple-darwin   # Apple Silicon
npm run tauri build -- --target x86_64-apple-darwin    # Intel
```

Output: `src-tauri/target/release/bundle/dmg/*.dmg`

### Windows (x64)

Requires a Windows machine (no cross-compilation from macOS).

```powershell
# Prerequisites
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools   # "Desktop development with C++" workload
winget install Microsoft.EdgeWebView2Runtime             # Usually pre-installed on Win 11

rustup default stable-x86_64-pc-windows-msvc

# Build
npm install
npm run tauri:build:win
```

Output: `src-tauri\target\release\bundle\nsis\*.exe` and `msi\*.msi`

Detailed guide: [`docs/TAURI_WINDOWS_BUILD.md`](docs/TAURI_WINDOWS_BUILD.md)

### Android (APK)

```bash
# Prerequisites: Android SDK, NDK, Java JDK
# Initialize Android project (one-time)
npx tauri android init

# Build signed APK
ANDROID_KEYSTORE_PATH="$HOME/.android/vfdashboard-upload.jks" \
ANDROID_KEY_ALIAS="vfdashboard" \
ANDROID_KEYSTORE_PASSWORD="YOUR_PASSWORD" \
ANDROID_KEY_PASSWORD="YOUR_PASSWORD" \
npm run tauri:build:android:signed
```

Output: `src-tauri/gen/android/app/build/outputs/apk/universal/release/VFDashboard_*_signed.apk`

Detailed guide: [`docs/TAURI_ANDROID_SIGNING.md`](docs/TAURI_ANDROID_SIGNING.md)

### iOS

> **Note:** Requires macOS with Xcode installed. Apple Developer account needed for device deployment.

```bash
# Initialize iOS project (one-time)
npx tauri ios init

# Development (simulator)
npx tauri ios dev

# Production build
npx tauri ios build
```

Output: Xcode project at `src-tauri/gen/apple/`. Open in Xcode for simulator testing or archive for App Store / Ad Hoc distribution.

### Upload Build Artifacts to GitHub Release

```bash
# Authenticate (one-time)
gh auth login

# Upload to existing release
gh release upload v1.0.0 <artifact-path> --clobber

# Or create a new release
gh release create v1.1.0 --draft --title "VFDashboard 1.1.0" <artifact-paths>
```

## ☁️ Deployment (Cloudflare Pages)

```bash
npx wrangler login   # One-time auth
npm run deploy
```

## 📚 Documentation

| Document                                                     | Description                           |
| ------------------------------------------------------------ | ------------------------------------- |
| [API Endpoints](./docs/api/API_ENDPOINTS.md)                 | REST API reference                    |
| [MQTT Telemetry](./docs/api/MQTT_TELEMETRY.md)               | Real-time data via AWS IoT Core       |
| [Hướng Dẫn Sử Dụng Tiếng Việt](./docs/USER_GUIDE_VI.md)      | User guide for Dashboard, Charging Live, and Battery Health |
| [X-HASH Technical Docs](./docs/api/HASH_ANALYSIS_SUMMARY.md) | Dual-layer API signing analysis       |
| [Proxy Failover](./docs/api/PROXY_FAILOVER.md)               | Multi-proxy 429 failover architecture |
| [Tauri Windows Build](./docs/TAURI_WINDOWS_BUILD.md)         | Windows native build guide            |
| [Tauri Android Signing](./docs/TAURI_ANDROID_SIGNING.md)     | Android signed APK guide              |
| [Cloudflare Deployment](./docs/DEPLOY_CLOUDFLARE.md)         | Cloudflare Pages setup                |

🌐 Vietnamese translations available at `docs/api/vi/`.

## 🤝 Contributing

We welcome contributions from the community!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🌍 Community Forks

VinFast owners in different regions maintain their own forks tailored to local needs:

| Fork                                                                                        | Maintainer                    | Focus                                                |
| ------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| [vinfastownersorg-cyber/VFDashboard](https://github.com/vinfastownersorg-cyber/VFDashboard) | Association of VinFast Owners | North America, self-hosted (Render, Docker, Railway) |

> Want to add your fork? Open an issue or PR!

## 🙏 Acknowledgments

This project was developed based on inspiration and valuable technical documentation regarding APIs from the [**VinFast Owners**](https://vinfastowners.org/) community. We sincerely thank the team at [VinFast Owners Community](https://github.com/vinfastownersorg-cyber/vinfastowners) for their foundational contributions to this open-source ecosystem.

Selected improvements from community forks are periodically reviewed and backported into this public branch when they align with security, maintainability, and broad community usage.

## ⚠️ Disclaimer

**This software is not affiliated with, endorsed by, or connected to VinFast Auto or its subsidiaries.** It is an unofficial, open-source project created by the community for educational and personal use. Use at your own risk.

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

---

_Built with ❤️ by VF9 Club Vietnam_
