import { getCollection } from 'astro:content';
import { home } from './home';
import { twin } from './pipeline/pages';
import type { AppInfo, PageInfo } from './seo';

/** The collection sorts its entries by id; the site lists pages in the order of the manifest. */
export function byManifest<T extends { data: { order: number } }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => a.data.order - b.data.order);
}

/** The pages of the collection, in the order of the manifest, with their Markdown twins. */
export async function sitePages(indexedOnly = false): Promise<PageInfo[]> {
  const pages = byManifest(await getCollection('pages'));
  return pages
    .filter(({ data }) => !indexedOnly || data.kind === 'doc')
    .map(({ id, data, body }) => {
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

/** The pages that the sitemap and the LLM files list. */
export function indexedPages(): Promise<PageInfo[]> {
  return sitePages(true);
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
