import { describe, expect, it } from 'vitest';
import {
  articleLd,
  llmsFullTxt,
  llmsTxt,
  robots,
  scriptJson,
  sitemap,
  softwareLd,
  trail,
  type AppInfo,
  type PageInfo,
} from '../src/seo';

const SITE = new URL('https://example.org');

const APP: AppInfo = {
  description: 'A tool that converts documents.',
  version: '1.2.3',
  operatingSystem: 'Linux',
  license: 'https://spdx.org/licenses/MIT.html',
};

function page(id: string, route: string, title: string): PageInfo {
  return {
    id,
    route,
    title,
    summary: `${title} summary.`,
    markdown: `# ${title}\n\n## Part\n\nBody of ${title}.\n`,
  };
}

const PAGES = [
  page('index', '/', 'Home'),
  page('install', '/install/', 'Install'),
  page('docs', '/docs/', 'Documentation'),
  page('docs/rules', '/docs/rules/', 'Rules'),
];

describe('scriptJson', () => {
  it('cannot close the script element', () => {
    const text = scriptJson({ name: '</script><b>' });
    expect(text).not.toContain('</script>');
    expect(JSON.parse(text)).toEqual({ name: '</script><b>' });
  });
});

describe('JSON-LD', () => {
  it('describes the tool with its version and its id', () => {
    const ld = softwareLd(APP, SITE) as Record<string, unknown>;
    expect(ld['@type']).toBe('SoftwareApplication');
    expect(ld['@id']).toBe('https://example.org/#app');
    expect(ld['softwareVersion']).toBe('1.2.3');
    expect(ld['image']).toBe('https://example.org/og/index.png');
  });

  it('walks from the home page down to the page', () => {
    const rules = PAGES[3] as PageInfo;
    expect(trail(rules, PAGES).map((p) => p.route)).toEqual([
      '/',
      '/docs/',
      '/docs/rules/',
    ]);
  });

  it('links the article to the tool and lists its breadcrumbs', () => {
    const [article, crumbs] = articleLd(
      PAGES[3] as PageInfo,
      PAGES,
      SITE,
    ) as Record<string, unknown>[];
    expect(article?.['@type']).toBe('TechArticle');
    expect(article?.['about']).toEqual({ '@id': 'https://example.org/#app' });
    expect(article?.['image']).toBe('https://example.org/og/docs/rules.png');
    expect(crumbs?.['itemListElement']).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://example.org/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Documentation',
        item: 'https://example.org/docs/',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Rules',
        item: 'https://example.org/docs/rules/',
      },
    ]);
  });
});

describe('discovery files', () => {
  it('lists every page in the sitemap', () => {
    const xml = sitemap(PAGES, SITE);
    expect(xml.match(/<loc>/g)).toHaveLength(PAGES.length);
    expect(xml).toContain('<loc>https://example.org/docs/rules/</loc>');
  });

  it('allows every crawler and names the sitemap', () => {
    const text = robots(SITE);
    expect(text).toMatch(/^User-agent: \*\nAllow: \/\n/);
    expect(text).not.toContain('Disallow');
    expect(text).toContain('User-agent: GPTBot');
    expect(text).toContain('Sitemap: https://example.org/sitemap.xml');
  });

  it('indexes the twins in llms.txt, docs apart', () => {
    const text = llmsTxt(APP, PAGES, SITE);
    expect(text).toMatch(/^# raw2md\n\n> A tool that converts documents\.\n/);
    expect(text).toContain('raw2md 1.2.3');
    const docs = text.slice(text.indexOf('## Docs'));
    expect(docs).toContain(
      '- [Rules](https://example.org/docs/rules.md): Rules summary.',
    );
    const pages = text.slice(text.indexOf('## Pages'), text.indexOf('## Docs'));
    expect(pages).toContain('- [Install](https://example.org/install.md)');
    expect(pages).not.toContain('Rules');
  });

  it('puts the address under each title in llms-full.txt', () => {
    const text = llmsFullTxt(APP, PAGES, SITE);
    expect(text).toContain(
      '# Rules\n\nSource: https://example.org/docs/rules/\n\n## Part\n\nBody of Rules.',
    );
    expect(text.match(/^Source: /gm)).toHaveLength(PAGES.length);
    expect(text.endsWith('.\n')).toBe(true);
  });
});
