import { defineConfig } from 'vite';

// Build timestamp shown in the app so parents can confirm which version is deployed.
const buildTime = new Date().toISOString();

export default defineConfig({
  base: '/',
  define: {
    __TEPUQ_BUILD_TIME__: JSON.stringify(buildTime),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
