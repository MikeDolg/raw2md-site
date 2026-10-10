import fs from 'node:fs';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import { manifest, type PageSpec, type SourceSpec } from './manifest';
import {
  applyEdits,
  isInside,
  outline,
  summary,
  type Edit,
  type Outline,
  type Range,
  type Section,
} from './markdown';

export interface Page {
  /** Collection id: `index` for `/`, `docs/cleaning` for `/docs/cleaning/`. */
  id: string;
  route: string;
  title: string;
  source: string;
  /** The first sentence of the page, for a list of pages. */
  summary: string;
  markdown: string;
}

export interface Site {
  version: string;
  pages: Page[];
}

const REPO = 'https://github.com/MikeDolg/raw2md';
const MAIN_LINK =
  /^https:\/\/github\.com\/MikeDolg\/raw2md\/(blob|tree)\/main\/([^#?]+?)\/?(#.*)?$/;
const ROUTE = /^\/(?:[a-z0-9-]+\/)*$/;

interface Draft {
  spec: PageSpec;
  file: string;
  text: string;
  outline: Outline;
  title: string;
  deletions: Range[];
  anchors: Set<string>;
}

/** The public tree: `RAW2MD_DOCS_DIR`, or `../public` next to the site. */
export function docsDir(): string {
  return path.resolve(process.env['RAW2MD_DOCS_DIR'] ?? '../public');
}

export function readVersion(dir: string): string {
  const toml = fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf8');
  let inProject = false;
  for (const line of toml.split(/\r?\n/)) {
    if (line.startsWith('[')) {
      inProject = line.trim() === '[project]';
    } else if (inProject) {
      const version = /^version\s*=\s*"([^"]+)"/.exec(line)?.[1];
      if (version) return version;
    }
  }
  throw new Error('pyproject.toml: no [project] version');
}

export function pageId(route: string): string {
  if (!ROUTE.test(route)) throw new Error(`manifest: bad route ${route}`);
  return route === '/' ? 'index' : route.slice(1, -1);
}

function findSection(sections: Section[], name: string, file: string): Section {
  const found = sections.filter((s) => s.name === name);
  if (found.length !== 1) {
    const problem =
      found.length === 0 ? 'has no heading' : 'repeats the heading';
    throw new Error(`${file} ${problem} "${name}" that the manifest names`);
  }
  return found[0] as Section;
}

function draftSource(source: SourceSpec, text: string): Draft[] {
  const doc = outline(text);
  const topSections = doc.sections.filter((s) => s.depth === doc.top);
  const dropped = (source.drop ?? []).map((name) =>
    findSection(doc.sections, name, source.file),
  );
  const kept = new Set<Section>();
  const drafts = source.pages.map((spec) => {
    const deletions: Range[] = [...doc.htmlBlocks, ...dropped];
    if (doc.titleRange) deletions.push(doc.titleRange);
    if (spec.keep) {
      const mine = new Set(
        spec.keep.map((name) => findSection(topSections, name, source.file)),
      );
      for (const section of mine) kept.add(section);
      deletions.push(...topSections.filter((s) => !mine.has(s)));
      if (!spec.intro) deletions.push(doc.preamble);
    }
    const title = spec.title ?? doc.title;
    if (!title)
      throw new Error(
        `${spec.route}: no title in the manifest or ${source.file}`,
      );
    const slugger = new GithubSlugger();
    const anchors = new Set(
      doc.sections
        .filter((s) => !isInside(s.start, deletions))
        .map((s) => slugger.slug(s.name)),
    );
    return {
      spec,
      file: source.file,
      text,
      outline: doc,
      title,
      deletions,
      anchors,
    };
  });
  if (source.pages.some((spec) => spec.keep)) {
    const lost = topSections.filter(
      (s) => !kept.has(s) && !dropped.includes(s),
    );
    if (lost.length > 0) {
      const names = lost.map((s) => `"${s.name}"`).join(', ');
      throw new Error(`${source.file}: no page keeps or drops ${names}`);
    }
  }
  return drafts;
}

class Linker {
  private readonly bySource = new Map<string, Draft[]>();

  constructor(
    drafts: Draft[],
    private readonly dir: string,
    private readonly version: string,
  ) {
    for (const draft of drafts) {
      const list = this.bySource.get(draft.file) ?? [];
      list.push(draft);
      this.bySource.set(draft.file, list);
    }
  }

  /** The new target of a link, or undefined to keep it. */
  resolve(url: string, image: boolean, from: Draft): string | undefined {
    const [target = '', anchor] = url.split('#', 2) as [string, string?];
    const hash = anchor === undefined ? '' : `#${anchor}`;
    if (target === '') {
      this.checkAnchor(from, anchor);
      return undefined;
    }
    const main = MAIN_LINK.exec(url);
    if (main) {
      const [, kind, file = ''] = main;
      const page = this.pageFor(
        kind === 'tree' ? `${file}/README.md` : file,
        anchor,
        from,
      );
      return page ? page.spec.route + hash : undefined;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return undefined;
    if (image)
      throw new Error(`${from.file}: relative image ${url} is not supported`);

    const file = path.posix
      .normalize(path.posix.join(path.posix.dirname(from.file), target))
      .replace(/\/$/, '');
    const local = path.join(this.dir, file);
    if (file.startsWith('../') || !fs.existsSync(local)) {
      throw new Error(`${from.file}: link to a missing file ${url}`);
    }
    const isDir = fs.statSync(local).isDirectory();
    const page = this.pageFor(isDir ? `${file}/README.md` : file, anchor, from);
    if (page) return page.spec.route + hash;
    return `${REPO}/${isDir ? 'tree' : 'blob'}/v${this.version}/${file}${hash}`;
  }

  private pageFor(
    file: string,
    anchor: string | undefined,
    from: Draft,
  ): Draft | undefined {
    const pages = this.bySource.get(file);
    if (!pages) return undefined;
    if (anchor === undefined) return pages[0];
    const slug = decodeURIComponent(anchor);
    const page = pages.find((p) => p.anchors.has(slug));
    if (!page)
      throw new Error(`${from.file}: no page of ${file} shows #${anchor}`);
    return page;
  }

  private checkAnchor(page: Draft, anchor: string | undefined): void {
    if (anchor !== undefined && !page.anchors.has(decodeURIComponent(anchor))) {
      throw new Error(
        `${page.file}: ${page.spec.route} does not show #${anchor}`,
      );
    }
  }
}

function render(draft: Draft, linker: Linker): Page {
  const replacements: Edit[] = [];
  for (const link of draft.outline.links) {
    if (isInside(link.start, draft.deletions)) continue;
    const url = linker.resolve(link.url, link.image, draft);
    if (url !== undefined)
      replacements.push({ start: link.start, end: link.end, text: url });
  }
  const markdown = applyEdits(draft.text, draft.deletions, replacements).trim();
  return {
    id: pageId(draft.spec.route),
    route: draft.spec.route,
    title: draft.title,
    source: draft.file,
    summary: draft.spec.summary ?? summary(markdown),
    markdown: `${markdown}\n`,
  };
}

export function buildSite(dir: string, sources: SourceSpec[] = manifest): Site {
  const version = readVersion(dir);
  const drafts = sources.flatMap((source) =>
    draftSource(source, fs.readFileSync(path.join(dir, source.file), 'utf8')),
  );
  const ids = drafts.map((d) => pageId(d.spec.route));
  const twice = ids.find((id, i) => ids.indexOf(id) !== i);
  if (twice) throw new Error(`manifest: two pages at ${twice}`);
  const linker = new Linker(drafts, dir, version);
  return { version, pages: drafts.map((draft) => render(draft, linker)) };
}

/** The Markdown twin of a page: its title and its body. */
export function twin(title: string, markdown: string): string {
  return `# ${title}\n\n${markdown}`;
}
