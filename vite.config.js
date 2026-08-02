import { defineConfig } from 'vite';
import { execSync } from 'child_process';

// Build timestamp shown in the app so parents can confirm which version is deployed.
// Using the commit timestamp keeps the bundle reproducible for the same source tree
// while still displaying a meaningful deployment-ish time.
function getBuildTime() {
  try {
    return execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
  } catch {
    return new Date().toISOString();
  }
}
const buildTime = getBuildTime();

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
