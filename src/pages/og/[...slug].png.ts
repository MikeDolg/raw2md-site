import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { home } from '../../home';
import { cardPng } from '../../og';
import { docsDir } from '../../pipeline/pages';

export const getStaticPaths = (async () => {
  const pages = await getCollection('pages');
  return pages.map((page) => ({ params: { slug: page.id }, props: { page } }));
}) satisfies GetStaticPaths;

interface Props {
  page: CollectionEntry<'pages'>;
}

export const GET: APIRoute<Props> = async ({ props }) => {
  const { id, data } = props.page;
  const logo = fs.readFileSync(
    path.join(docsDir(), 'docs/assets/raw2md-logo.svg'),
    'utf8',
  );
  const isHome = id === 'index';
  const png = await cardPng({
    heading: isHome ? home.headline : data.title,
    text: isHome ? home.tagline : data.summary,
    version: data.version,
    logo,
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
