import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SourceSpec } from '../src/pipeline/manifest';
import {
  buildSite,
  pageId,
  readVersion,
  twin,
  type Page,
} from '../src/pipeline/pages';
import { summary } from '../src/pipeline/markdown';

const PYPROJECT =
  '[build-system]\nversion = "9"\n\n[project]\nname = "x"\nversion = "1.2.3"\n';

const README = `<h1 align="center">
  <img src="logo.svg" alt="logo">
</h1>

<p align="center">
  <a href="https://ci.example"><img src="badge.svg" alt="CI"></a>
</p>

Intro text.

## Overview

See the [guide](https://github.com/MikeDolg/raw2md/blob/main/docs/guide.md#usage),
the [samples](https://github.com/MikeDolg/raw2md/tree/main/samples),
the [license](https://github.com/MikeDolg/raw2md/blob/main/LICENSE),
and [elsewhere](https://example.com/a_(b).pdf).

## Install

\`\`\`bash
# Windows
pip install x
\`\`\`

## Legal

Terms.
`;

const GUIDE = `# Guide

Lead.

## Usage

Run it. Back to [usage](#usage), the [install](../README.md#install),
the [data](../extra/data.txt#l1), and the [folder](../extra/).

### Constants

A list.

## Last
`;

let dirs: string[] = [];

function tree(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raw2md-site-'));
  dirs.push(dir);
  for (const [file, text] of Object.entries({
    'pyproject.toml': PYPROJECT,
    ...files,
  })) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

const SOURCES: SourceSpec[] = [
  {
    file: 'README.md',
    drop: ['Legal'],
    pages: [
      { route: '/', title: 'Home', intro: true, keep: ['Overview'] },
      { route: '/install/', title: 'Setup', keep: ['Install'] },
    ],
  },
  {
    file: 'docs/guide.md',
    drop: ['Constants'],
    pages: [{ route: '/docs/guide/' }],
  },
  {
    file: 'samples/README.md',
    pages: [{ route: '/samples/', title: 'Samples' }],
  },
];

const FILES = {
  'README.md': README,
  'docs/guide.md': GUIDE,
  'samples/README.md': 'Samples.\n',
  'extra/data.txt': 'data\n',
};

function page(pages: Page[], route: string): Page {
  const found = pages.find((p) => p.route === route);
  if (!found) throw new Error(`no page ${route}`);
  return found;
}

describe('readVersion', () => {
  it('reads the version of the [project] table', () => {
    expect(readVersion(tree({}))).toBe('1.2.3');
  });

  it('fails without a [project] version', () => {
    const dir = tree({ 'pyproject.toml': '[tool.x]\nversion = "2"\n' });
    expect(() => readVersion(dir)).toThrow(/no \[project\] version/);
  });
});

describe('pageId', () => {
  it('maps a route to a collection id', () => {
    expect(pageId('/')).toBe('index');
    expect(pageId('/docs/guide/')).toBe('docs/guide');
  });

  it('rejects a route without the trailing slash', () => {
    expect(() => pageId('/docs')).toThrow(/bad route/);
  });
});

describe('buildSite', () => {
  it('splits a source into pages by its top-level sections', () => {
    const site = buildSite(tree(FILES), SOURCES);
    expect(site.version).toBe('1.2.3');
    const home = page(site.pages, '/');
    expect(home.markdown.startsWith('Intro text.\n\n## Overview\n')).toBe(true);
    expect(home.markdown).not.toContain('## Install');
    const install = page(site.pages, '/install/');
    expect(install.markdown).toBe(
      '## Install\n\n```bash\n# Windows\npip install x\n```\n',
    );
  });

  it('drops the HTML header and the dropped sections', () => {
    const pages = buildSite(tree(FILES), SOURCES).pages;
    const all = pages.map((p) => p.markdown).join('\n');
    expect(all).not.toContain('<p');
    expect(all).not.toContain('<h1');
    expect(all).not.toContain('Legal');
    expect(all).not.toContain('Constants');
    expect(page(pages, '/docs/guide/').markdown).toContain('## Last');
  });

  it('takes the title from the leading level-1 heading', () => {
    const guide = page(buildSite(tree(FILES), SOURCES).pages, '/docs/guide/');
    expect(guide.title).toBe('Guide');
    expect(guide.markdown.startsWith('Lead.\n')).toBe(true);
  });

  it('rewrites the links to the pages and to the tagged repository', () => {
    const pages = buildSite(tree(FILES), SOURCES).pages;
    const home = page(pages, '/').markdown;
    expect(home).toContain('[guide](/docs/guide/#usage)');
    expect(home).toContain('[samples](/samples/)');
    expect(home).toContain(
      '[license](https://github.com/MikeDolg/raw2md/blob/main/LICENSE)',
    );
    expect(home).toContain('[elsewhere](https://example.com/a_(b).pdf)');
    const guide = page(pages, '/docs/guide/').markdown;
    expect(guide).toContain('[usage](#usage)');
    expect(guide).toContain('[install](/install/#install)');
    expect(guide).toContain(
      '[data](https://github.com/MikeDolg/raw2md/blob/v1.2.3/extra/data.txt#l1)',
    );
    expect(guide).toContain(
      '[folder](https://github.com/MikeDolg/raw2md/tree/v1.2.3/extra)',
    );
  });

  it.each([
    ['a kept heading', { keep: ['Gone'] }, /README\.md has no heading "Gone"/],
    [
      'a dropped heading',
      { drop: ['Gone'] },
      /README\.md has no heading "Gone"/,
    ],
  ])('fails on a missing %s', (_, change, error) => {
    const readme = SOURCES[0] as SourceSpec;
    const source: SourceSpec =
      'keep' in change
        ? {
            ...readme,
            pages: [{ route: '/', keep: change.keep, title: 'Home' }],
          }
        : { ...readme, drop: change.drop };
    expect(() => buildSite(tree(FILES), [source])).toThrow(error);
  });

  it('fails on a top-level section that no page keeps or drops', () => {
    const readme = { ...(SOURCES[0] as SourceSpec), drop: [] };
    expect(() => buildSite(tree(FILES), [readme, ...SOURCES.slice(1)])).toThrow(
      /no page keeps or drops "Legal"/,
    );
  });

  it('skips the links of a section that the page leaves out', () => {
    const files = {
      ...FILES,
      'README.md': README.replace(
        '## Install\n',
        '## Install\n\nSee [this](#install).\n',
      ),
    };
    const { pages } = buildSite(tree(files), SOURCES);
    expect(page(pages, '/install/').markdown).toContain('[this](#install)');
  });

  it('fails on a link to a missing file', () => {
    const files = {
      ...FILES,
      'docs/guide.md': `${GUIDE}\nSee [gone](gone.md).\n`,
    };
    expect(() => buildSite(tree(files), SOURCES)).toThrow(
      /missing file gone\.md/,
    );
  });

  it('fails on an anchor that the target page does not show', () => {
    const files = {
      ...FILES,
      'docs/guide.md': `${GUIDE}\nSee [c](#constants).\n`,
    };
    expect(() => buildSite(tree(files), SOURCES)).toThrow(
      /does not show #constants/,
    );
    const other = {
      ...FILES,
      'docs/guide.md': `${GUIDE}\nSee [l](../README.md#legal).\n`,
    };
    expect(() => buildSite(tree(other), SOURCES)).toThrow(
      /no page of README\.md shows #legal/,
    );
  });

  it('fails on a relative image', () => {
    const files = {
      ...FILES,
      'docs/guide.md': `${GUIDE}\n![chart](chart.png)\n`,
    };
    expect(() => buildSite(tree(files), SOURCES)).toThrow(
      /relative image chart\.png/,
    );
  });

  it('fails on two pages at one route', () => {
    const twice: SourceSpec[] = [
      ...SOURCES,
      {
        file: 'extra/data.txt',
        pages: [{ route: '/samples/', title: 'Data' }],
      },
    ];
    expect(() => buildSite(tree(FILES), twice)).toThrow(/two pages at samples/);
  });
});

describe('twin', () => {
  it('puts the title over the body', () => {
    expect(twin('Guide', 'Lead.\n')).toBe('# Guide\n\nLead.\n');
  });
});

describe('summary', () => {
  it('takes the first sentence of the first paragraph as plain text', () => {
    expect(
      summary('## Head\n\nThe `cleaning` stage\nruns first. Then more.\n'),
    ).toBe('The cleaning stage runs first.');
  });

  it('takes a whole paragraph without a sentence end', () => {
    expect(summary('Just words')).toBe('Just words');
  });

  it('gives an empty summary to a text without a paragraph', () => {
    expect(summary('## Only a heading\n')).toBe('');
  });
});
