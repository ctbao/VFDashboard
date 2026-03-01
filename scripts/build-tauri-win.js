#!/usr/bin/env node
import { execSync } from "child_process";
import { platform } from "os";

const onWindows = platform() === "win32";
const target = process.env.TAURI_WIN_TARGET || "x86_64-pc-windows-msvc";

if (!onWindows) {
  console.warn(
    `[tauri:build:win] Current OS is not Windows (${platform()}). This script is intended to run on Windows.`,
  );
}

try {
  console.log("[tauri:build:win] Building static frontend for Tauri...");
  execSync("npm run build:tauri", { stdio: "inherit" });

  console.log(
    `[tauri:build:win] Building Tauri bundle for target ${target}...`,
  );
  execSync(`npx tauri build --target ${target}`, { stdio: "inherit" });

  console.log("[tauri:build:win] Build finished.");
} catch (error) {
  console.error("[tauri:build:win] Build failed:", error.message);
  process.exit(1);
}
