export const REPO = 'https://github.com/MikeDolg/raw2md';
export const PYPI = 'https://pypi.org/project/raw2md/';
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** What the discovery files need to know about a page. */
export interface PageInfo {
  id: string;
  route: string;
  title: string;
  summary: string;
  /** The Markdown twin: the title and the body. */
  markdown: string;
}

export interface AppInfo {
  description: string;
  version: string;
  operatingSystem: string;
  license: string;
}

export function absolute(path: string, site: URL): string {
  return new URL(path, site).href;
}

export function twinPath(page: Pick<PageInfo, 'id'>): string {
  return `/${page.id}.md`;
}

export function ogImagePath(page: Pick<PageInfo, 'id'>): string {
  return `/og/${page.id}.png`;
}

/** JSON for a `<script>` element: `<` is escaped, so the text cannot close the element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function appId(site: URL): string {
  return `${absolute('/', site)}#app`;
}

export function softwareLd(app: AppInfo, site: URL): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': appId(site),
    name: 'raw2md',
    description: app.description,
    url: absolute('/', site),
    image: absolute(ogImagePath({ id: 'index' }), site),
    applicationCategory: 'DeveloperApplication',
    operatingSystem: app.operatingSystem,
    softwareVersion: app.version,
    license: app.license,
    downloadUrl: PYPI,
    sameAs: [REPO, PYPI],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}

/** The pages from the home page down to `page`, the home page first. */
export function trail(page: PageInfo, pages: PageInfo[]): PageInfo[] {
  const parents = pages.filter(
    (p) => p.route !== page.route && page.route.startsWith(p.route),
  );
  parents.sort((a, b) => a.route.length - b.route.length);
  return [...parents, page];
}

export function articleLd(
  page: PageInfo,
  pages: PageInfo[],
  site: URL,
): object[] {
  const url = absolute(page.route, site);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: page.title,
      description: page.summary,
      url,
      mainEntityOfPage: url,
      image: absolute(ogImagePath(page), site),
      inLanguage: 'en',
      about: { '@id': appId(site) },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: trail(page, pages).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.title,
        item: absolute(p.route, site),
      })),
    },
  ];
}

export function sitemap(pages: PageInfo[], site: URL): string {
  const urls = pages.map(
    (p) => `  <url><loc>${absolute(p.route, site)}</loc></url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** Every crawler may read the site; the training crawlers are named so that the intent is explicit. */
export function robots(site: URL): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    'User-agent: GPTBot',
    'User-agent: ClaudeBot',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    `Sitemap: ${absolute('/sitemap.xml', site)}`,
    '',
  ].join('\n');
}

function llmsHeader(app: AppInfo, site: URL): string[] {
  return [
    '# raw2md',
    '',
    `> ${app.description}`,
    '',
    `This site documents raw2md ${app.version}, the last release on PyPI.`,
    `Each page has a Markdown copy at the same address with \`.md\` at the end. ` +
      `The full text of all pages is in [llms-full.txt](${absolute('/llms-full.txt', site)}).`,
  ];
}

/** The index of the site in the llms.txt format, with links to the Markdown twins. */
export function llmsTxt(app: AppInfo, pages: PageInfo[], site: URL): string {
  const entry = (p: PageInfo) =>
    `- [${p.title}](${absolute(twinPath(p), site)}): ${p.summary}`;
  const docs = pages.filter((p) => p.route.startsWith('/docs/'));
  const rest = pages.filter((p) => !docs.includes(p));
  return [
    ...llmsHeader(app, site),
    '',
    '## Pages',
    '',
    ...rest.map(entry),
    '',
    '## Docs',
    '',
    ...docs.map(entry),
    '',
    '## Project',
    '',
    `- [GitHub](${REPO}): the source code and the issues`,
    `- [PyPI](${PYPI}): the package`,
    '',
  ].join('\n');
}

/** The full text of the site: every Markdown twin, each with its address. */
export function llmsFullTxt(
  app: AppInfo,
  pages: PageInfo[],
  site: URL,
): string {
  const bodies = pages.map((p) => {
    const [title = '', ...body] = p.markdown.split('\n');
    return [title, '', `Source: ${absolute(p.route, site)}`, ...body]
      .join('\n')
      .trimEnd();
  });
  return `${[llmsHeader(app, site).join('\n'), ...bodies].join('\n\n')}\n`;
}
