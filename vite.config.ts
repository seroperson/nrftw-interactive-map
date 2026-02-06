import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/nrftw-interactive-map/",
  assetsInclude: ["**/*.csv"],
  server: {
    port: 3000,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192x192.png", "icon-512x512.png", "*.csv"],
      manifest: {
        name: 'Map for "No Rest for The Wicked"',
        short_name: "NRFTW Map",
        description: "Interactive resource map for No Rest for The Wicked game",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        id: "/nrftw-interactive-map/",
        scope: "./",
        start_url: "./",
        orientation: "any",
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,csv}"],
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      pwaAssets: {
        // all defaults
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
