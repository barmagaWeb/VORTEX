/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// Use the deployment commit as a build identifier so open tabs can detect releases.
const buildVersion = (() => {
  const fromEnvironment = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.VORTEX_BUILD_VERSION;
  if (fromEnvironment) return fromEnvironment.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return `local-${Date.now()}`;
  }
})();

// Generated at build time; it must never be cached by the browser.
writeFileSync(path.resolve(__dirname, 'public/version.json'), JSON.stringify({ version: buildVersion }) + '\n');

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __VORTEX_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [react()],
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
