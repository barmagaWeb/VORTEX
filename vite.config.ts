/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';

// Use the exact commit being deployed as the version checked by open browser tabs.
const buildVersion = (() => {
  const fromEnvironment = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.VORTEX_BUILD_VERSION;
  if (fromEnvironment) return fromEnvironment.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return `local-${Date.now()}`;
  }
})();

const versionAssetPlugin: Plugin = {
  name: 'vortex-version-asset',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: buildVersion }),
    });
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves this repository under /VORTEX/; root-hosted builds stay at /.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/VORTEX/' : '/',
  define: {
    __VORTEX_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [react(), versionAssetPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
