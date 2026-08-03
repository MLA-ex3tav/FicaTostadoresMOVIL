import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const host = process.env.CAPACITOR_HOST;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["assets/logo.webp", "assets/icon.png"],
      manifest: {
        name: "Fica Tostadores",
        short_name: "FicaTost",
        description: "Panel de administración móvil de Fica Tostadores",
        theme_color: "#e85d04",
        background_color: "#1f1f25",
        display: "standalone",
        orientation: "portrait",
        lang: "es",
        icons: [
          {
            src: "assets/icon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "assets/icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,webp,png,svg,woff2}"],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
  },
  clearScreen: false,
});
