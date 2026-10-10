import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { builtRoutes, checkDist, pageId } from '../scripts/dist-check';

const ORIGIN = 'https://example.org';
const ROUTES = ['/', '/docs/', '/docs/post/'];

let dist = '';

function put(path: string, text: string) {
  const file = join(dist, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function read(path: string): string {
  return readFileSync(join(dist, path), 'utf8');
}

function pageHtml(route: string): string {
  const id = pageId(route);
  return (
    `<!DOCTYPE html><html><head>` +
    `<link rel="canonical" href="${ORIGIN}${route}">` +
    `<link rel="alternate" type="text/markdown" href="/${id}.md">` +
    `<meta property="og:image" content="${ORIGIN}/og/${id}.png">` +
    `</head><body></body></html>`
  );
}

function buildSite() {
  for (const route of ROUTES) {
    const id = pageId(route);
    put(join(route, 'index.html'), pageHtml(route));
    put(`${id}.md`, `# ${id}\n`);
    put(`og/${id}.png`, 'png');
  }
  put('404.html', '<!DOCTYPE html>');
  put(
    'sitemap.xml',
    ROUTES.map((r) => `<url><loc>${ORIGIN}${r}</loc></url>`).join('\n'),
  );
  put(
    'llms.txt',
    ROUTES.map((r) => `- [t](${ORIGIN}/${pageId(r)}.md): s`).join('\n'),
  );
  put(
    'llms-full.txt',
    ROUTES.map((r) => `# t\n\nSource: ${ORIGIN}${r}\n`).join('\n'),
  );
}

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'raw2md-dist-'));
  buildSite();
});

afterEach(() => {
  rmSync(dist, { recursive: true, force: true });
});

describe('pageId', () => {
  it('names the home page index and drops the slashes of the others', () => {
    expect(pageId('/')).toBe('index');
    expect(pageId('/docs/post/')).toBe('docs/post');
  });
});

describe('builtRoutes', () => {
  it('lists the folders with an index and skips 404.html', () => {
    expect(builtRoutes(dist)).toEqual(ROUTES);
  });
});

function hiddenPage(route: string) {
  const id = pageId(route);
  put(
    join(route, 'index.html'),
    pageHtml(route)
      .replace(/<link rel="canonical"[^>]*>/, '')
      .replace(
        '<head>',
        '<head><meta name="robots" content="noindex, follow">',
      ),
  );
  put(`${id}.md`, `# ${id}\n`);
  put(`og/${id}.png`, 'png');
}

describe('checkDist', () => {
  it('accepts a site in which every page is complete', () => {
    expect(checkDist(dist)).toEqual([]);
  });

  it('reports a missing Markdown twin', () => {
    rmSync(join(dist, 'docs/post.md'));
    expect(checkDist(dist)).toEqual([
      '/docs/post/: no Markdown twin docs/post.md',
    ]);
  });

  it('reports a page that the sitemap does not list', () => {
    put('sitemap.xml', `<loc>${ORIGIN}/</loc><loc>${ORIGIN}/docs/</loc>`);
    expect(checkDist(dist)).toEqual(['/docs/post/: not in sitemap.xml']);
  });

  it('reports a sitemap entry without a page', () => {
    put(
      'sitemap.xml',
      ROUTES.map((r) => `<loc>${ORIGIN}${r}</loc>`).join('') +
        `<loc>${ORIGIN}/gone/</loc>`,
    );
    expect(checkDist(dist)).toEqual([
      `sitemap.xml: ${ORIGIN}/gone/ is not a built page`,
    ]);
  });

  it('reports a page that llms.txt and llms-full.txt omit', () => {
    put('llms.txt', `- [t](${ORIGIN}/index.md): s\n`);
    put('llms-full.txt', `Source: ${ORIGIN}/\n`);
    expect(checkDist(dist)).toEqual([
      '/docs/: not in llms.txt',
      '/docs/: not in llms-full.txt',
      '/docs/post/: not in llms.txt',
      '/docs/post/: not in llms-full.txt',
    ]);
  });

  it('reports an alternate link to another twin', () => {
    put('docs/index.html', pageHtml('/docs/').replace('/docs.md', '/x.md'));
    expect(checkDist(dist)).toEqual(['/docs/: no alternate link to /docs.md']);
  });

  it('reports a canonical link that names another page', () => {
    put(
      'docs/post/index.html',
      pageHtml('/docs/post/').replace(
        `href="${ORIGIN}/docs/post/"`,
        `href="${ORIGIN}/docs/"`,
      ),
    );
    const problems = checkDist(dist);
    expect(problems).toContain(
      `/docs/post/: the canonical link ${ORIGIN}/docs/ names another page`,
    );
    expect(problems).toContain(
      `sitemap.xml: ${ORIGIN}/docs/post/ is not a built page`,
    );
  });

  it('accepts a noindex page that no list names', () => {
    hiddenPage('/docs/post/part-1/');
    expect(checkDist(dist)).toEqual([]);
  });

  it('reports a noindex page with a canonical link or in a list', () => {
    const route = '/docs/post/part-1/';
    hiddenPage(route);
    const html = pageHtml(route).replace(
      '<head>',
      '<head><meta name="robots" content="noindex">',
    );
    put(join(route, 'index.html'), html);
    put('sitemap.xml', `${read('sitemap.xml')}<loc>${ORIGIN}${route}</loc>`);
    put(
      'llms.txt',
      `${read('llms.txt')}\n- [p](${ORIGIN}/docs/post/part-1.md): s`,
    );
    put(
      'llms-full.txt',
      `${read('llms-full.txt')}\nSource: ${ORIGIN}${route}\n`,
    );
    expect(checkDist(dist)).toEqual([
      `${route}: a noindex page has a canonical link`,
      `${route}: a noindex page in sitemap.xml`,
      `${route}: a noindex page in llms.txt`,
      `${route}: a noindex page in llms-full.txt`,
      `sitemap.xml: ${ORIGIN}${route} is not a built page`,
    ]);
  });

  it('checks the twin and the image of a noindex page', () => {
    const route = '/docs/post/part-1/';
    hiddenPage(route);
    rmSync(join(dist, 'docs/post/part-1.md'));
    expect(checkDist(dist)).toEqual([
      `${route}: no Markdown twin docs/post/part-1.md`,
    ]);
  });

  it('reports a missing OpenGraph image file', () => {
    rmSync(join(dist, 'og/docs.png'));
    expect(checkDist(dist)).toEqual([
      `/docs/: the file of og:image ${ORIGIN}/og/docs.png is missing`,
    ]);
  });
});
