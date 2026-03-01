// @ts-check
// Astro config for Tauri desktop build — static output (no server needed)
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  devToolbar: {
    enabled: false,
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      // Signal to client code that this is a Tauri build
      "import.meta.env.TAURI_BUILD": JSON.stringify("true"),
    },
  },
});
