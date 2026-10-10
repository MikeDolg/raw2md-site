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
  type LinkTarget,
  type Outline,
  type Range,
  type Section,
} from './markdown';

/**
 * `doc` is a page of the search index. `contents` lists the excerpts of a
 * source, and `part` is one of them: both stay outside the index.
 */
export type PageKind = 'doc' | 'contents' | 'part';

export interface Page {
  /** Collection id: `index` for `/`, `docs/cleaning` for `/docs/cleaning/`. */
  id: string;
  route: string;
  title: string;
  source: string;
  /** The first sentence of the page, for a list of pages. */
  summary: string;
  markdown: string;
  kind: PageKind;
  /** Markdown line over the page: the source and the license of the text. */
  notice?: string;
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
  kind: PageKind;
  file: string;
  text: string;
  outline: Outline;
  title: string;
  deletions: Range[];
  /** Heading marks that a part rewrites, so that its leading heading is level 1. */
  shifts: Edit[];
  anchors: Set<string>;
}

const RESULT_HEADER = /^---\r?\n([\s\S]*?\r?\n)---\r?\n/;

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

/** Blanks the YAML header of a result in place, so that it parses as no Markdown. */
function maskHeader(text: string): string {
  const header = RESULT_HEADER.exec(text);
  if (!header) return text;
  return header[0].replace(/[^\r\n]/g, ' ') + text.slice(header[0].length);
}

function anchorsOf(doc: Outline, deletions: Range[]): Set<string> {
  const slugger = new GithubSlugger();
  return new Set(
    doc.sections
      .filter((s) => !isInside(s.start, deletions))
      .map((s) => slugger.slug(s.name)),
  );
}

function escapeLabel(text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, '\\$&');
}

/** The contents page of a source shown by excerpts, and a page for each excerpt. */
function excerptDrafts(
  source: SourceSpec,
  spec: PageSpec,
  excerpts: string[],
  text: string,
  doc: Outline,
  version: string,
): Draft[] {
  if (spec.keep || spec.intro)
    throw new Error(`${spec.route}: excerpts go without keep and intro`);
  const title = spec.title ?? doc.title;
  if (!title)
    throw new Error(
      `${spec.route}: no title in the manifest or ${source.file}`,
    );
  const parts = excerpts.map((name) =>
    findSection(doc.sections, name, source.file),
  );
  parts.forEach((part, i) => {
    const before = parts[i - 1];
    if (before && part.start < before.end)
      throw new Error(
        `${source.file}: the excerpt "${part.name}" does not follow "${before.name}"`,
      );
  });

  const name = path.posix.basename(source.file);
  const whole = `The whole result is [${escapeLabel(name)}](${REPO}/blob/v${version}/${source.file}) on GitHub.`;
  const notice = spec.notice === undefined ? whole : `${spec.notice} ${whole}`;
  const titles = parts.map((part) => part.name.replace(/[.:]$/, ''));
  const partRoute = (i: number) => `${spec.route}part-${i + 1}/`;
  const header = RESULT_HEADER.exec(text);
  const contentsText = [
    ...(header ? [`\`\`\`yaml\n${header[1]}\`\`\``, ''] : []),
    `The site shows ${parts.length} parts of the result.`,
    '',
    ...titles.map((t, i) => `${i + 1}. [${escapeLabel(t)}](${partRoute(i)})`),
    '',
  ].join('\n');
  const contents: Draft = {
    spec: { ...spec, notice },
    kind: 'contents',
    file: source.file,
    text: contentsText,
    outline: outline(contentsText),
    title,
    deletions: [],
    shifts: [],
    anchors: new Set(),
  };

  const drafts = parts.map((part, i): Draft => {
    const deletions: Range[] = [
      { start: 0, end: part.body },
      { start: part.end, end: text.length },
    ];
    const shift = part.depth - 1;
    const inside = doc.sections.filter(
      (s) => s !== part && s.start >= part.start && s.start < part.end,
    );
    const shifts = (shift === 0 ? [] : inside).map((s) => {
      if (!text.startsWith('#'.repeat(s.depth), s.start))
        throw new Error(`${source.file}: "${s.name}" is not an ATX heading`);
      return {
        start: s.start,
        end: s.start + s.depth,
        text: '#'.repeat(s.depth - shift),
      };
    });
    return {
      spec: {
        route: partRoute(i),
        summary: `${title}, part ${i + 1} of ${parts.length}: ${titles[i]}.`,
        notice,
      },
      kind: 'part',
      file: source.file,
      text,
      outline: doc,
      title: titles[i] ?? part.name,
      deletions,
      shifts,
      anchors: anchorsOf(doc, deletions),
    };
  });
  return [contents, ...drafts];
}

function draftSource(
  source: SourceSpec,
  text: string,
  version: string,
): Draft[] {
  const doc = outline(maskHeader(text));
  const topSections = doc.sections.filter((s) => s.depth === doc.top);
  const dropped = (source.drop ?? []).map((name) =>
    findSection(doc.sections, name, source.file),
  );
  const kept = new Set<Section>();
  const drafts = source.pages.flatMap((spec): Draft[] => {
    if (spec.excerpts)
      return excerptDrafts(source, spec, spec.excerpts, text, doc, version);
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
    return [
      {
        spec,
        kind: 'doc',
        file: source.file,
        text,
        outline: doc,
        title,
        deletions,
        shifts: [],
        anchors: anchorsOf(doc, deletions),
      },
    ];
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

function linkEdits(links: LinkTarget[], draft: Draft, linker: Linker): Edit[] {
  return links.flatMap((link) => {
    if (isInside(link.start, draft.deletions)) return [];
    const url = linker.resolve(link.url, link.image, draft);
    return url === undefined
      ? []
      : [{ start: link.start, end: link.end, text: url }];
  });
}

function render(draft: Draft, linker: Linker): Page {
  const replacements =
    draft.kind === 'contents'
      ? []
      : [...draft.shifts, ...linkEdits(draft.outline.links, draft, linker)];
  const markdown = applyEdits(draft.text, draft.deletions, replacements).trim();
  const page: Page = {
    id: pageId(draft.spec.route),
    route: draft.spec.route,
    title: draft.title,
    source: draft.file,
    summary: draft.spec.summary ?? summary(markdown),
    markdown: `${markdown}\n`,
    kind: draft.kind,
  };
  const { notice } = draft.spec;
  if (notice !== undefined) {
    const links = outline(notice).links;
    const edits = linkEdits(links, { ...draft, deletions: [] }, linker);
    page.notice = applyEdits(notice, [], edits);
  }
  return page;
}

export function buildSite(dir: string, sources: SourceSpec[] = manifest): Site {
  const version = readVersion(dir);
  const drafts = sources.flatMap((source) =>
    draftSource(
      source,
      fs.readFileSync(path.join(dir, source.file), 'utf8'),
      version,
    ),
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
