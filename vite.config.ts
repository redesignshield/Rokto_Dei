import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkgJson = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf-8')
) as { version?: string };
const APP_VERSION = pkgJson.version || '1.0.0';
const APP_BUILD_TIME = new Date().toISOString();
const GITHUB_REPO = (process.env.VITE_GITHUB_REPO || '').trim();

function excludeDevArtifactsFromDist(): Plugin {
  return {
    name: 'exclude-aistudio-dev-artifacts',
    apply: 'build',
    closeBundle() {
      const targetDir = path.resolve(import.meta.dirname, 'dist', 'assets', 'aistudio');
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    },
  };
}

function emitVersionManifest(): Plugin {
  return {
    name: 'emit-version-manifest',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, 'dist');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(distDir, 'version.json'),
        JSON.stringify(
          {
            version: APP_VERSION,
            buildTime: APP_BUILD_TIME,
            githubRepo: GITHUB_REPO,
          },
          null,
          2
        )
      );
    },
  };
}

export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __APP_BUILD_TIME__: JSON.stringify(APP_BUILD_TIME),
      __GITHUB_REPO__: JSON.stringify(GITHUB_REPO),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'logo.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'রক্তদেই (Rokto Dei)',
          short_name: 'Rokto Dei',
          description:
            'বাংলাদেশে রক্তপ্রার্থী ও স্বেচ্ছায় রক্তদাতাদের দ্রুত ও নিরাপদ যোগাযোগ প্ল্যাটফর্ম।',
          theme_color: '#C80828',
          background_color: '#FAF8F9',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          lang: 'bn',
          categories: ['medical', 'health', 'social'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/assets/aistudio/**', '**/version.json'],
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/\.well-known\//,
            /^\/version\.json$/,
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      excludeDevArtifactsFromDist(),
      emitVersionManifest(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase/')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-lucide';
            }
            if (id.includes('node_modules/@vis.gl/react-google-maps/')) {
              return 'vendor-maps';
            }
          },
        },
      },
      chunkSizeWarningLimit: 650,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
