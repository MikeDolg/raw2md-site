import type { APIRoute } from 'astro';
import { llmsTxt } from '../seo';
import { appInfo, sitePages } from '../site';

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('astro.config.mjs: no site');
  return new Response(llmsTxt(await appInfo(), await sitePages(), site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
