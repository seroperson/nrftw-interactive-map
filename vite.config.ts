import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { createHtmlPlugin } from "vite-plugin-html";

export default defineConfig(({ mode }) => ({
  base: "/",
  assetsInclude: ["**/*.csv"],
  server: {
    port: 3000,
  },
  plugins: [
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          PROD: mode === "production",
        },
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "pwa-64x64.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "maskable-icon-512x512.png",
        "apple-touch-icon-512x512.png",
        "*.csv",
        "*.json",
      ],
      manifest: {
        name: 'Map for "No Rest for The Wicked"',
        short_name: "NRFTW Map",
        description: "Interactive resource map for No Rest for The Wicked game",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        id: "/",
        scope: "/",
        start_url: "/",
        orientation: "any",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,csv,json}"],
        maximumFileSizeToCacheInBytes: 10485760, // 10mb
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 10000, // a lot of files because of tiles
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
        skipWaiting: true,
      },
      pwaAssets: {
        image: "public/pwa-512x512.png",
        overrideManifestIcons: true,
        preset: {
          transparent: {
            sizes: [64, 192, 512],
            favicons: [[48, "favicon.ico"]],
          },
          maskable: {
            sizes: [512],
            padding: 0.1,
            resizeOptions: {
              background: "#1a1a1a",
            },
          },
          apple: {
            sizes: [180],
            padding: 0.1,
            resizeOptions: {
              background: "#1a1a1a",
            },
          },
        },
      },
    }),
  ],
}));
