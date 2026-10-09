import { getCollection } from 'astro:content';
import { home } from './home';
import { manifest } from './pipeline/manifest';
import { pageId, twin } from './pipeline/pages';
import type { AppInfo, PageInfo } from './seo';

const ORDER = manifest.flatMap((source) =>
  source.pages.map((spec) => pageId(spec.route)),
);

/** The collection sorts its entries by id; the site lists pages in the order of the manifest. */
export function byManifest<T extends { id: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

/** The pages of the collection, in the order of the manifest, with their Markdown twins. */
export async function sitePages(): Promise<PageInfo[]> {
  const pages = byManifest(await getCollection('pages'));
  return pages.map(({ id, data, body }) => {
    if (body === undefined) throw new Error(`${data.route}: no body`);
    return {
      id,
      route: data.route,
      title: data.title,
      summary: data.summary,
      markdown: twin(data.title, body),
    };
  });
}

/** The facts of the tool for the JSON-LD and the LLM files. */
export async function appInfo(): Promise<AppInfo> {
  const pages = await getCollection('pages');
  const index = pages.find((p) => p.id === 'index');
  if (!index) throw new Error('site: no index page');
  return {
    description: index.data.summary,
    version: index.data.version,
    ...home.app,
  };
}
