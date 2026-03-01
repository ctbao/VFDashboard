#!/usr/bin/env node
/**
 * Build script for Tauri frontend.
 *
 * The dashboard uses Astro SSR with server-side API routes (src/pages/api/).
 * For Tauri, we build as static — no server needed because the Tauri app
 * handles API calls directly via the HTTP plugin (see src/utils/tauriFetch.js).
 *
 * This script temporarily moves the API routes aside during the static build,
 * since Astro static mode errors on `prerender = false` exports.
 */
import { execSync } from "child_process";
import { existsSync, renameSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const apiDir = resolve(root, "src/pages/api");
const apiBackup = resolve(root, "src/pages/_api_tauri_backup");

function moveAway() {
  if (existsSync(apiDir)) {
    if (existsSync(apiBackup)) {
      // Previous backup exists (interrupted build?) — remove stale backup
      rmSync(apiBackup, { recursive: true });
    }
    renameSync(apiDir, apiBackup);
    console.log("[tauri-build] Moved src/pages/api/ aside for static build");
  }
}

function restore() {
  if (existsSync(apiBackup)) {
    if (existsSync(apiDir)) {
      rmSync(apiDir, { recursive: true });
    }
    renameSync(apiBackup, apiDir);
    console.log("[tauri-build] Restored src/pages/api/");
  }
}

try {
  moveAway();
  console.log("[tauri-build] Building Astro static frontend...");
  execSync("npx astro build --config astro.config.tauri.mjs", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, TAURI_BUILD: "true" },
  });
  console.log("[tauri-build] Frontend build complete.");
} catch (e) {
  console.error("[tauri-build] Build failed:", e.message);
  process.exitCode = 1;
} finally {
  // Always restore API routes
  restore();
}
