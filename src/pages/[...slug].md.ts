import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { twin } from '../pipeline/pages';

export const getStaticPaths = (async () => {
  const pages = await getCollection('pages');
  return pages.map((page) => ({ params: { slug: page.id }, props: { page } }));
}) satisfies GetStaticPaths;

interface Props {
  page: CollectionEntry<'pages'>;
}

export const GET: APIRoute<Props> = ({ props }) => {
  const { data, body } = props.page;
  if (body === undefined) throw new Error(`${data.route}: no body`);
  return new Response(twin(data.title, body), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
