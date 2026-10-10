import path from 'node:path';
import { defineCollection } from 'astro:content';
import type { Loader, LoaderContext } from 'astro/loaders';
import { z } from 'astro/zod';
import { manifest } from './pipeline/manifest';
import { buildSite, docsDir } from './pipeline/pages';

async function load({ store, parseData, renderMarkdown }: LoaderContext) {
  const site = buildSite(docsDir());
  store.clear();
  for (const [order, page] of site.pages.entries()) {
    const notice =
      page.notice === undefined
        ? undefined
        : (await renderMarkdown(page.notice)).html;
    const data = await parseData({
      id: page.id,
      data: {
        route: page.route,
        title: page.title,
        source: page.source,
        summary: page.summary,
        version: site.version,
        kind: page.kind,
        order,
        ...(notice === undefined ? {} : { notice }),
      },
    });
    // The twin carries the notice too, so the license goes with the text.
    const body =
      page.notice === undefined
        ? page.markdown
        : `> ${page.notice}

${page.markdown}`;
    store.set({
      id: page.id,
      data,
      body,
      rendered: await renderMarkdown(page.markdown),
    });
  }
}

const publicDocs: Loader = {
  name: 'public-docs',
  load: async (context) => {
    await load(context);
    const dir = docsDir();
    const files = [
      'pyproject.toml',
      ...manifest.map((source) => source.file),
    ].map((file) => path.join(dir, file));
    context.watcher?.add(files);
    context.watcher?.on('change', (changed) => {
      if (files.includes(path.resolve(changed))) void load(context);
    });
  },
};

const pages = defineCollection({
  loader: publicDocs,
  schema: z.object({
    route: z.string(),
    title: z.string(),
    source: z.string(),
    summary: z.string(),
    version: z.string(),
    kind: z.enum(['doc', 'contents', 'part']),
    /** Place of the page in the manifest. */
    order: z.number(),
    /** HTML of the notice over the page. */
    notice: z.string().optional(),
  }),
});

export const collections = { pages };
