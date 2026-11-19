import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths, so the built site works under any GitHub Pages repo path.
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts', 'apps-script/src/**/*.test.ts'],
  },
});
