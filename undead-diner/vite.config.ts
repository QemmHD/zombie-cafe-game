import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps asset paths relative so the build works when opened from a
// file path or wrapped in a native shell.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', target: 'es2020' }
});
