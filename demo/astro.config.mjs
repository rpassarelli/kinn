import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  build: { format: 'file' },
  vite: { server: { fs: { allow: ['..'] } } },
});
