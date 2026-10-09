import { parse } from 'yaml';
import { z } from 'astro/zod';
import text from './home.yaml?raw';

const Home = z.strictObject({
  tagline: z.string(),
  headline: z.string(),
  install: z.string(),
  facts: z.array(z.string()),
  intro: z.string(),
  app: z.strictObject({ operatingSystem: z.string(), license: z.string() }),
  labels: z.record(z.string(), z.string()),
  faq: z.array(z.strictObject({ question: z.string(), answer: z.string() })),
});

export type Home = z.infer<typeof Home>;

export const home: Home = Home.parse(parse(text));

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/** Hand-written text to HTML: escaped, with `code` spans. */
export function inline(value: string): string {
  const escaped = value.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
  return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
}

export interface HomeSection {
  id: string;
  /** The heading element and the content under it, as HTML. */
  html: string;
}

/**
 * Splits the rendered home page into its intro and its level-2 sections.
 * The Markdown escapes `<` in code, so a tag here is always real markup.
 */
export function splitSections(html: string): {
  intro: string;
  sections: HomeSection[];
} {
  const first = html.search(/<h2[\s>]/);
  const at = first === -1 ? html.length : first;
  const intro = html.slice(0, at);
  const parts = html
    .slice(at)
    .split(/(?=<h2[\s>])/)
    .filter(Boolean);
  const sections = parts.map((part) => {
    const id = /^<h2 id="([^"]+)"/.exec(part)?.[1];
    if (!id)
      throw new Error(`home: a section without an id: ${part.slice(0, 80)}`);
    return { id, html: part };
  });
  return { intro, sections };
}

/** The label of a README section; smart punctuation does not change the key. */
export function sectionLabel(heading: string): string {
  const key = heading.replace(/[‘’]/g, "'");
  const label = home.labels[key];
  if (label === undefined) throw new Error(`home.yaml: no label for "${key}"`);
  return label;
}
