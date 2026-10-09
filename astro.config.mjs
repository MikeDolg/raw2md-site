import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://raw2md.com',
  publicDir: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
