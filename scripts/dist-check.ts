import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The routes of the built pages: every `index.html` under `dist`, as a path with slashes at both ends. */
export function builtRoutes(dist: string): string[] {
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === 'index.html') {
        const folder = relative(dist, dir).split(sep).join('/');
        routes.push(folder === '' ? '/' : `/${folder}/`);
      }
    }
  };
  walk(dist);
  return routes.sort();
}

/** The name of a route in the twin, the image, and the discovery paths: `/docs/post/` is `docs/post`. */
export function pageId(route: string): string {
  const id = route.replace(/^\/|\/$/g, '');
  return id === '' ? 'index' : id;
}

const NOINDEX = /<meta name="robots" content="noindex\b/;

function read(dist: string, path: string): string {
  return readFileSync(join(dist, path), 'utf8');
}

function metaContent(html: string, property: string): string | undefined {
  const tag = new RegExp(
    `<meta [^>]*property="${property}" content="([^"]*)"`,
  ).exec(html);
  return tag?.[1];
}

function linkHref(html: string, attrs: string): string | undefined {
  const tag = new RegExp(`<link ${attrs} href="([^"]*)"`).exec(html);
  return tag?.[1];
}

function fileProblems(dist: string, route: string, html: string): string[] {
  const id = pageId(route);
  const problems: string[] = [];
  if (!existsSync(join(dist, `${id}.md`)))
    problems.push(`${route}: no Markdown twin ${id}.md`);
  if (linkHref(html, 'rel="alternate" type="text/markdown"') !== `/${id}.md`)
    problems.push(`${route}: no alternate link to /${id}.md`);
  const image = metaContent(html, 'og:image');
  if (image === undefined) problems.push(`${route}: no og:image`);
  else if (!existsSync(join(dist, new URL(image).pathname)))
    problems.push(`${route}: the file of og:image ${image} is missing`);
  return problems;
}

/**
 * The problems of the built site. An empty list means every page is reachable
 * by every route a crawler uses, and a `noindex` page by none of the lists.
 */
export function checkDist(dist: string): string[] {
  const problems: string[] = [];
  const sitemap = new Set(
    [...read(dist, 'sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => m[1] ?? '',
    ),
  );
  const llms = read(dist, 'llms.txt');
  const llmsFull = read(dist, 'llms-full.txt');
  const sources = [...llmsFull.matchAll(/^Source: (\S+)$/gm)].map(
    (m) => new URL(m[1] ?? '').pathname,
  );
  const canonicals = new Set<string>();

  for (const route of builtRoutes(dist)) {
    const id = pageId(route);
    const html = read(dist, join(route, 'index.html'));
    const canonical = linkHref(html, 'rel="canonical"');
    if (NOINDEX.test(html)) {
      if (canonical !== undefined)
        problems.push(`${route}: a noindex page has a canonical link`);
      if ([...sitemap].some((loc) => new URL(loc).pathname === route))
        problems.push(`${route}: a noindex page in sitemap.xml`);
      if (llms.includes(`/${id}.md)`))
        problems.push(`${route}: a noindex page in llms.txt`);
      if (sources.includes(route))
        problems.push(`${route}: a noindex page in llms-full.txt`);
      problems.push(...fileProblems(dist, route, html));
      continue;
    }
    if (canonical === undefined) {
      problems.push(`${route}: no canonical link`);
      continue;
    }
    canonicals.add(canonical);

    const origin = new URL(canonical).origin;
    if (new URL(canonical).pathname !== route)
      problems.push(
        `${route}: the canonical link ${canonical} names another page`,
      );
    if (!sitemap.has(canonical)) problems.push(`${route}: not in sitemap.xml`);
    if (!llms.includes(`](${origin}/${id}.md)`))
      problems.push(`${route}: not in llms.txt`);
    if (!llmsFull.includes(`Source: ${canonical}\n`))
      problems.push(`${route}: not in llms-full.txt`);
    problems.push(...fileProblems(dist, route, html));
  }

  for (const loc of sitemap)
    if (!canonicals.has(loc))
      problems.push(`sitemap.xml: ${loc} is not a built page`);
  return problems;
}
