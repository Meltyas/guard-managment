import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'GuardManagement',
      fileName: 'guard-management',
      formats: ['es'],
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['foundry'],
      output: {
        globals: {
          foundry: 'foundry',
        },
      },
    },
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  server: {
    open: false,
    host: true
  },
  preview: {
    open: false
  },
  test: {
    globals: true,
    environment: 'jsdom',
    watch: false,
    reporters: ['verbose']
  },
});
