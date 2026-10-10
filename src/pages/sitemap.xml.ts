import type { APIRoute } from 'astro';
import { sitemap } from '../seo';
import { indexedPages } from '../site';

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('astro.config.mjs: no site');
  return new Response(sitemap(await indexedPages(), site), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
