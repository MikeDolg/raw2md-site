import path from 'node:path';
import { defineCollection } from 'astro:content';
import type { Loader, LoaderContext } from 'astro/loaders';
import { z } from 'astro/zod';
import { manifest } from './pipeline/manifest';
import { buildSite, docsDir } from './pipeline/pages';

async function load({ store, parseData, renderMarkdown }: LoaderContext) {
  const site = buildSite(docsDir());
  store.clear();
  for (const page of site.pages) {
    const data = await parseData({
      id: page.id,
      data: {
        route: page.route,
        title: page.title,
        source: page.source,
        version: site.version,
      },
    });
    store.set({
      id: page.id,
      data,
      body: page.markdown,
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
    version: z.string(),
  }),
});

export const collections = { pages };
