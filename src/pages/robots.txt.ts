import type { APIRoute } from 'astro';
import { robots } from '../seo';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('astro.config.mjs: no site');
  return new Response(robots(site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
