import type { Heading, Nodes, Root, RootContent } from 'mdast';
import { markdownToMdast } from 'satteri';

export interface Range {
  start: number;
  end: number;
}

export interface Section extends Range {
  name: string;
  depth: number;
  /** Where the body begins: after the heading and its blank lines. */
  body: number;
}

export interface LinkTarget extends Range {
  url: string;
  image: boolean;
}

export interface Outline {
  /** Text of the leading level-1 heading, when the document has one. */
  title: string | undefined;
  /** The leading level-1 heading line, which the page title replaces. */
  titleRange: Range | undefined;
  /** The text before the first section, after the title. */
  preamble: Range;
  /** Every root heading except the title, with the range of its section. */
  sections: Section[];
  /** The smallest depth among `sections`. */
  top: number;
  /** Root HTML blocks: the logo header and the badges of a README. */
  htmlBlocks: Range[];
  links: LinkTarget[];
}

function startOf(node: Nodes): number {
  const offset = node.position?.start.offset;
  if (offset === undefined) throw new Error(`no position on a ${node.type}`);
  return offset;
}

function endOf(node: Nodes): number {
  const offset = node.position?.end.offset;
  if (offset === undefined) throw new Error(`no position on a ${node.type}`);
  return offset;
}

export function plainText(node: Nodes): string {
  if ('value' in node) return node.value;
  if ('children' in node) return node.children.map(plainText).join('');
  return '';
}

/** Range of the root node up to the next root node, so blank lines go too. */
function blockRange(text: string, nodes: RootContent[], index: number): Range {
  const node = nodes[index] as RootContent;
  const next = nodes[index + 1];
  return { start: startOf(node), end: next ? startOf(next) : text.length };
}

/** Range of the destination in `[text](url)` or `[label]: url`, if any. */
function destination(text: string, node: Nodes, url: string): Range | null {
  const start = startOf(node);
  const raw = text.slice(start, endOf(node));
  let at: number;
  if (node.type === 'definition') {
    at = start + raw.indexOf(']:') + 2;
  } else if (raw.startsWith('[') || raw.startsWith('![')) {
    at = start + raw.lastIndexOf('](') + 2;
  } else {
    return null;
  }
  while (/\s/.test(text.charAt(at))) at += 1;
  if (text.charAt(at) === '<') at += 1;
  if (!text.startsWith(url, at)) {
    throw new Error(`cannot locate the link target ${url} at offset ${start}`);
  }
  return { start: at, end: at + url.length };
}

function collectLinks(text: string, node: Nodes, out: LinkTarget[]): void {
  if (
    node.type === 'link' ||
    node.type === 'image' ||
    node.type === 'definition'
  ) {
    const range = destination(text, node, node.url);
    if (range)
      out.push({ ...range, url: node.url, image: node.type === 'image' });
  }
  if ('children' in node) {
    for (const child of node.children) collectLinks(text, child, out);
  }
}

export function outline(text: string): Outline {
  const root = markdownToMdast(text) as Root;
  const nodes = root.children;
  const headingAt = nodes.flatMap((node, index) =>
    node.type === 'heading' ? [{ node, index }] : [],
  );

  let title: string | undefined;
  let titleRange: Range | undefined;
  let rest = headingAt;
  const first = headingAt[0];
  const levelOne = headingAt.filter(({ node }) => node.depth === 1).length;
  if (first && first.node.depth === 1 && levelOne === 1) {
    title = plainText(first.node);
    titleRange = blockRange(text, nodes, first.index);
    rest = headingAt.slice(1);
  }

  const headings: Heading[] = rest.map(({ node }) => node);
  const sections = rest.map(({ node: heading, index }, i) => {
    const next = headings.slice(i + 1).find((h) => h.depth <= heading.depth);
    return {
      name: plainText(heading),
      depth: heading.depth,
      start: startOf(heading),
      end: next ? startOf(next) : text.length,
      body: blockRange(text, nodes, index).end,
    };
  });

  const htmlBlocks = nodes.flatMap((node, index) =>
    node.type === 'html' ? [blockRange(text, nodes, index)] : [],
  );
  const links: LinkTarget[] = [];
  collectLinks(text, root, links);

  return {
    title,
    titleRange,
    preamble: {
      start: titleRange?.end ?? 0,
      end: sections[0]?.start ?? text.length,
    },
    sections,
    top: Math.min(...sections.map((s) => s.depth)),
    htmlBlocks,
    links,
  };
}

export interface Edit extends Range {
  text: string;
}

/** Apply edits that do not overlap; deletions may overlap each other. */
export function applyEdits(
  text: string,
  deletions: Range[],
  replacements: Edit[],
): string {
  const merged: Range[] = [];
  for (const range of [...deletions].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  const edits: Edit[] = [
    ...merged.map((range) => ({ ...range, text: '' })),
    ...replacements.filter(
      (edit) => !merged.some((r) => edit.start >= r.start && edit.end <= r.end),
    ),
  ].sort((a, b) => b.start - a.start);
  let result = text;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

export function isInside(offset: number, ranges: Range[]): boolean {
  return ranges.some((r) => offset >= r.start && offset < r.end);
}

/** The first sentence of the first root paragraph, as plain text. */
export function summary(text: string): string {
  const root = markdownToMdast(text) as Root;
  const paragraph = root.children.find((node) => node.type === 'paragraph');
  if (!paragraph) return '';
  const plain = plainText(paragraph).replace(/\s+/g, ' ').trim();
  const end = plain.search(/[.!?](\s|$)/);
  return end === -1 ? plain : plain.slice(0, end + 1);
}
