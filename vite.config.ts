import { defineConfig } from 'vite';

// GitHub Pages serves this project site at https://<owner>.github.io/zombie-cafe-game/
// so the production base path must match the repo name. Dev server uses '/'.
// If the repo is ever renamed, update `base` (or drive it from an env var).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/zombie-cafe-game/' : '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
  },
  server: {
    host: true,
  },
}));
