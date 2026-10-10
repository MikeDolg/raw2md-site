import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import { siteHtml, soleDisplayMath } from './src/pipeline/html';

export default defineConfig({
  site: 'https://raw2md.com',
  publicDir: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: {
    processor: satteri({
      mdastPlugins: [soleDisplayMath],
      hastPlugins: [siteHtml],
      features: { math: true },
    }),
    syntaxHighlight: false,
  },
});
