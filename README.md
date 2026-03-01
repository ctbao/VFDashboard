# VinFast Dashboard - VF9 Club Edition

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/Node.js-22%2B-green)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

---

> ### 🇻🇳 Thông tin dành cho người dùng Việt Nam
>
> - **Vui lòng cảnh giác với website/app giả mạo.** Không đăng nhập tài khoản VinFast trên các website lạ hoặc ứng dụng tải từ nguồn không tin cậy.
> - **Chỉ sử dụng khi bạn tự đánh giá là tin tưởng và chấp nhận rủi ro.** Đây là dự án cộng đồng, không phải sản phẩm chính thức của VinFast.
> - **Link website chính thức của dự án:** [**dashboard.vf9.club**](https://dashboard.vf9.club)
> - **Các bản build desktop/mobile:** xem tại [**GitHub Releases**](https://github.com/VF9-Club/VFDashboard/releases)
> - **Cam kết minh bạch:** mọi bản build phát hành đều dựa trên source code public trong repository này.
>
> Giao lưu cùng tác giả: [**ANH EM VF9 - VF9 CLUB**](https://www.facebook.com/groups/706124277686588/)
>
> _📄 English documentation below._

---

## 🔄 **Status Update** (February 2026)

> **Dashboard is fully operational with real-time MQTT telemetry!** All vehicle data streams live via MQTT over WebSocket — first data arrives ~500ms after connect.
>
> ✅ **MQTT Live Telemetry**: Real-time data via AWS IoT Core (battery, doors, tires, location, speed, charging).\
> ✅ **X-HASH + X-HASH-2**: Dual-layer API signing on all protected endpoints.\
> ✅ **Multi-Vehicle**: Instant switching between vehicles with cached telemetry.\
> ✅ **Charging History**: Full session history with smart filtering.\
> ✅ **Deep Scan**: Progressive telemetry viewer with crowdsourced KV aliases.\
> 📚 **Documentation**: [API Endpoints](./docs/api/API_ENDPOINTS.md) | [X-HASH Technical Docs](./docs/api/HASH_ANALYSIS_SUMMARY.md) | [MQTT Telemetry](./docs/api/MQTT_TELEMETRY.md)\
> 🌐 **Bilingual docs**: English at `docs/api/`, Vietnamese at `docs/api/vi/`

---

## 📖 Introduction

This project is an open-source dashboard designed specifically for VinFast EV owners. It leverages the vehicle's telemetry data to provide a "Digital Twin" experience, offering real-time insights into battery health, charging status, tire pressure, and environmental conditions.

Our goal is to create a UI that matches the premium quality of the car itself—clean, modern, and informative.

## ✨ Features

- **Digital Twin Visualizer**: Accurate representation of vehicle status including doors, locks, and tires.
- **Mobile-First Experience**: Optimized specifically for phone screens with zero scrollbars, fixed viewports, and touch-friendly layouts.
- **Real-time Telemetry via MQTT**: Live streaming of Battery SOC, Range, Speed, Charging status, and more via AWS IoT Core WebSocket.
- **Safety Monitor**: Integrated alerts for Tire Pressure (TPMS), Door Ajar, and Intrusion.
- **System Health**: Overview of ECU versions (BMS, Gateway, MHU) and FOTA updates.
- **Responsive Design**: A "Bento Grid" layout that adapts seamlessly from Desktop to Mobile.

## 🛠 Tech Stack

- **Core**: Astro 5, React, Tailwind CSS, Nanostores.
- **Backend**: Serverless Proxy (Astro SSR on Cloudflare Pages) with multi-proxy 429 failover.
- **Telemetry**: MQTT over WebSocket (AWS IoT Core) — real-time, no polling.
- **Auth**: Auth0 OAuth2 with HttpOnly cookies (auto-detects localhost for local dev).
- **Storage**: Cloudflare KV for crowdsourced telemetry aliases.

## 🏗 System Architecture

![System Architecture](docs/assets/system-architecture.svg)

## 🚀 Quick Start

You can get the whole system running in minutes.

### Prerequisites

- Node.js v22 or later
- A VinFast Connected Car Account

### Installation

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/VF9-Club/VFDashboard.git
    cd VFDashboard
    ```

2.  **Start the Dashboard**:
    ```bash
    npm install
    npm run dev
    ```
    _Dashboard will open at `http://localhost:4321`_

### Deployment

To deploy the dashboard to Cloudflare Pages:

```bash
npm run deploy
```

_Note: Requires Cloudflare authentication (`npx wrangler login`)._

### Update Windows build from a Windows machine

```powershell
npm install
npm run tauri:build:win
gh auth login
gh release upload v1.0.0 .\src-tauri\target\release\bundle\nsis\*.exe .\src-tauri\target\release\bundle\msi\*.msi --clobber
```

Detailed guide: `docs/TAURI_WINDOWS_BUILD.md`

## ⚠ Disclaimer

**This software is not affiliated with, endorsed by, or connected to VinFast Auto or its subsidiaries.**
It is an unofficial, open-source project created by the community for educational and personal use. Use at your own risk.

## 📸 Screenshots

### Dashboard (PC / Tablet)

![Dashboard Preview](docs/assets/dashboard_preview.webp)

### Mobile & Detail View

<table><tr>
  <td><img src="public/mobile-vf3.webp" alt="Mobile Dashboard - VF3" width="280" /></td>
  <td><img src="public/mobile-vf9-energy.webp" alt="Mobile Dashboard - VF9 Energy" width="280" /></td>
  <td><img src="public/mobile-vf3-charging.webp" alt="Mobile - VF3 Charging History" width="280" /></td>
</tr></table>

## 🤝 Contributing

We welcome contributions from the community!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 🌍 Community Forks

VinFast owners in different regions maintain their own forks tailored to local needs:

| Fork                                                                                        | Maintainer                    | Focus                                                |
| ------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| [vinfastownersorg-cyber/VFDashboard](https://github.com/vinfastownersorg-cyber/VFDashboard) | Association of VinFast Owners | North America, self-hosted (Render, Docker, Railway) |

> Want to add your fork? Open an issue or PR!

## 🙏 Acknowledgments

This project was developed based on inspiration and valuable technical documentation regarding APIs from the [**VinFast Owners**](https://vinfastowners.org/) community. We sincerely thank the team at [VinFast Owners Community](https://github.com/vinfastownersorg-cyber/vinfastowners) for their foundational contributions to this open-source ecosystem.

Selected improvements from community forks are periodically reviewed and backported into this public branch when they align with security, maintainability, and broad community usage.

We warmly welcome all VinFast owners and technology enthusiasts to collaborate and help improve the public dashboard experience.

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

_Built with ❤️ by VF9 Club Vietnam_
