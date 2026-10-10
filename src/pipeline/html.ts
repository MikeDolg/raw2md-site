import GithubSlugger from 'github-slugger';
import type { Element, ElementContent } from 'hast';
import katex from 'katex';
import type {
  HastPluginEntry,
  HastVisitorContext,
  MdastPluginEntry,
} from 'satteri';

const NUMBER = /^[+\-−]?\d[\d.,]*\s?%?$/;
const PLACEHOLDER = /^[–—-]$/;
const ARROW = ' → ';

function el(
  tagName: string,
  properties: Element['properties'],
  children: ElementContent[] = [],
): Element {
  return { type: 'element', tagName, properties, children };
}

function elements(node: Readonly<Element>, tagName?: string): Element[] {
  return node.children.filter(
    (c): c is Element =>
      c.type === 'element' && (tagName === undefined || c.tagName === tagName),
  );
}

function hasClass(node: Readonly<Element>, name: string): boolean {
  const classes = node.properties['className'];
  return Array.isArray(classes) && classes.map(String).includes(name);
}

/**
 * A formula as MathML, which the browser draws without CSS or JS. A broken
 * formula keeps its source in a `katex-error` span, and the dist check fails.
 * A display formula scrolls in a focusable box, as a wide table does.
 */
function formula(
  code: Readonly<Element>,
  display: boolean,
  ctx: HastVisitorContext,
): Element | { type: 'raw'; value: string } {
  const value = katex.renderToString(ctx.textContent(code), {
    output: 'mathml',
    displayMode: display,
    throwOnError: false,
    strict: 'ignore',
  });
  if (!display) return { type: 'raw', value };
  return el('div', { className: ['formula'], tabIndex: 0 }, [
    { type: 'raw', value },
  ]);
}

/** A code block with a head line: its language and a Copy button. */
function codeBlock(pre: Readonly<Element>, ctx: HastVisitorContext): Element {
  const code = elements(pre, 'code')[0];
  const classes = code?.properties['className'];
  const language = Array.isArray(classes)
    ? classes
        .map(String)
        .find((c) => c.startsWith('language-'))
        ?.slice('language-'.length)
    : undefined;
  const text = code ? ctx.textContent(code) : ctx.textContent(pre);
  const head = el('div', { className: ['code-head'] }, [
    el('span', {}, [{ type: 'text', value: language ?? 'text' }]),
    el('button', { className: ['copy'], type: 'button', hidden: true }, [
      { type: 'text', value: 'Copy' },
    ]),
  ]);
  const body = el('pre', {}, [
    el('code', {}, [{ type: 'text', value: text.replace(/\n$/, '') }]),
  ]);
  return el('div', { className: ['code'] }, [head, body]);
}

/** Right-aligns the columns whose body cells all hold numbers. */
function markNumbers(table: Readonly<Element>, ctx: HastVisitorContext): void {
  const rows = (section: string) =>
    elements(table, section).flatMap((s) =>
      elements(s, 'tr').map((tr) =>
        elements(tr).filter((c) => c.tagName === 'td' || c.tagName === 'th'),
      ),
    );
  const head = rows('thead');
  const body = rows('tbody');
  const width = Math.max(0, ...body.map((r) => r.length));
  for (let col = 0; col < width; col++) {
    const texts = body.map((r) => {
      const cell = r[col];
      return cell ? ctx.textContent(cell).trim() : '';
    });
    const numeric =
      texts.some((t) => NUMBER.test(t)) &&
      texts.every((t) => NUMBER.test(t) || PLACEHOLDER.test(t));
    if (!numeric) continue;
    for (const row of [...head, ...body]) {
      const cell = row[col];
      if (cell) ctx.setProperty(cell, 'className', ['num']);
    }
  }
}

function wrapTable(
  table: Readonly<Element>,
  number: number,
  ctx: HastVisitorContext,
): void {
  markNumbers(table, ctx);
  const columns = elements(table, 'thead')
    .flatMap((s) => elements(s, 'tr'))
    .flatMap((tr) => elements(tr, 'th'))
    .map((th) => ctx.textContent(th).trim())
    .filter((t) => t !== '');
  ctx.wrapNode(
    table,
    el('section', {
      className: ['table-box'],
      tabIndex: 0,
      ariaLabel: `Table ${number}: ${columns.join(', ')}`,
    }),
  );
}

/** Splits `- a → b` items into a defect column and a result column. */
function arrowList(list: Readonly<Element>, ctx: HastVisitorContext): void {
  const items = elements(list, 'li');
  const splits = items.map((li) => {
    if (elements(li).some((c) => ['p', 'ul', 'ol', 'pre'].includes(c.tagName)))
      return undefined;
    const at = li.children.findIndex(
      (c) => c.type === 'text' && c.value.includes(ARROW),
    );
    const text = li.children[at];
    if (text?.type !== 'text' || ctx.textContent(li).split('→').length !== 2)
      return undefined;
    const [left = '', right = ''] = text.value.split(ARROW, 2);
    const before: ElementContent[] = [
      ...li.children.slice(0, at),
      { type: 'text', value: left },
    ];
    const after: ElementContent[] = [
      { type: 'text', value: right },
      ...li.children.slice(at + 1),
    ];
    return { li, before, after };
  });
  if (items.length === 0 || splits.some((s) => s === undefined)) return;
  ctx.setProperty(list, 'className', ['fixes']);
  for (const split of splits) {
    if (!split) continue;
    ctx.replaceNode(
      split.li,
      el('li', {}, [
        el('span', {}, split.before),
        el('span', { className: ['arrow'], ariaHidden: 'true' }, [
          { type: 'text', value: '→' },
        ]),
        el('span', { className: ['res'] }, split.after),
      ]),
    );
  }
}

/**
 * A paragraph that holds one `$$...$$` and nothing else becomes a display
 * formula, as GitHub draws it. The parser reads a one-line `$$...$$` as
 * inline math, and `\tag` or `split` fail in inline mode.
 */
export const soleDisplayMath: MdastPluginEntry = () => ({
  name: 'sole-display-math',
  options: { position: true },
  paragraph(node, ctx) {
    const [only, ...rest] = node.children;
    if (only?.type !== 'inlineMath' || rest.length > 0) return undefined;
    const start = only.position?.start.offset;
    if (start === undefined || !ctx.source.startsWith('$$', start))
      return undefined;
    return { type: 'math', value: only.value };
  },
});

/**
 * Site markup for rendered Markdown. The heading ids follow the slugs of
 * Astro, so the anchor and the table of contents point at the same id.
 */
export const siteHtml: HastPluginEntry = () => {
  const slugger = new GithubSlugger();
  let tables = 0;
  return {
    name: 'site-html',
    element: {
      filter: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'pre',
        'code',
        'table',
        'ul',
      ],
      visit(node, ctx) {
        if (node.tagName === 'code')
          return hasClass(node, 'math-inline')
            ? formula(node, false, ctx)
            : undefined;
        if (node.tagName === 'pre') {
          const code = elements(node, 'code')[0];
          return code && hasClass(code, 'math-display')
            ? formula(code, true, ctx)
            : codeBlock(node, ctx);
        }
        if (node.tagName === 'table') return wrapTable(node, ++tables, ctx);
        if (node.tagName === 'ul') return arrowList(node, ctx);
        const existing = node.properties['id'];
        const id =
          typeof existing === 'string'
            ? existing
            : slugger.slug(ctx.textContent(node));
        ctx.setProperty(node, 'id', id);
        if (node.tagName === 'h1') return undefined;
        ctx.appendChild(
          node,
          el('a', {
            className: ['anchor'],
            href: `#${id}`,
            ariaLabel: 'Link to this section',
          }),
        );
        return undefined;
      },
    },
  };
};
