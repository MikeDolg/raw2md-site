import { markdownToHtml } from 'satteri';
import { describe, expect, it } from 'vitest';
import { siteHtml, soleDisplayMath } from '../src/pipeline/html';

async function render(markdown: string): Promise<string> {
  const { html } = await markdownToHtml(markdown, {
    mdastPlugins: [soleDisplayMath],
    hastPlugins: [siteHtml],
    features: { gfm: true, math: true },
  });
  return html;
}

describe('siteHtml', () => {
  it('puts a head line with the language and a hidden Copy button on code', async () => {
    const html = await render('```bash\nls -l\n```\n');
    expect(html).toContain(
      '<div class="code"><div class="code-head"><span>bash</span>' +
        '<button class="copy" type="button" hidden>Copy</button></div>' +
        '<pre><code>ls -l</code></pre></div>',
    );
  });

  it('names a code block without a language as text', async () => {
    expect(await render('```\nplain\n```\n')).toContain('<span>text</span>');
  });

  it('wraps a table in a focusable region named by its columns', async () => {
    const html = await render('| Name | Note |\n|---|---|\n| a | b |\n');
    expect(html).toContain(
      '<section class="table-box" tabindex="0" aria-label="Table 1: Name, Note"><table>',
    );
  });

  it('numbers the tables of a page, so that every region name is unique', async () => {
    const table = '| Name | Note |\n|---|---|\n| a | b |\n';
    const html = await render(`${table}\n${table}`);
    expect(html).toContain('aria-label="Table 1: Name, Note"');
    expect(html).toContain('aria-label="Table 2: Name, Note"');
  });

  it('right-aligns a column of numbers and placeholders only', async () => {
    const html = await render(
      '| File | Pages | Note |\n|---|---|---|\n| a | 344 | x |\n| b | – | 12 |\n| c | +3.1% | y |\n',
    );
    expect(html).toContain('<th class="num">Pages</th>');
    expect(html).toContain('<td class="num">344</td>');
    expect(html).toContain('<td class="num">–</td>');
    expect(html).toContain('<td>12</td>');
    expect(html).toContain('<th>File</th>');
  });

  it('gives a heading the slug id and an empty anchor link', async () => {
    const html = await render("## What's new\n\n## What's new\n");
    expect(html).toContain(
      `<h2 id="whats-new">What's new<a class="anchor" href="#whats-new" aria-label="Link to this section"></a></h2>`,
    );
    expect(html).toContain('<h2 id="whats-new-1">');
  });

  it('splits a list of arrow items into two columns', async () => {
    const html = await render(
      '- `marker` links → their text\n- loops → one copy\n',
    );
    expect(html).toContain('<ul class="fixes">');
    expect(html).toContain(
      '<li><span><code>marker</code> links</span>' +
        '<span class="arrow" aria-hidden="true">→</span>' +
        '<span class="res">their text</span></li>',
    );
  });

  it('renders an inline formula as MathML in the running text', async () => {
    const html = await render('Let $a^2$ be.\n');
    expect(html).toContain(
      '<p>Let <span class="katex"><math xmlns="http://www.w3.org/1998/Math/MathML">' +
        '<semantics><mrow><msup><mi>a</mi><mn>2</mn></msup></mrow>' +
        '<annotation encoding="application/x-tex">a^2</annotation></semantics></math></span> be.</p>',
    );
  });

  it('renders a display formula as block MathML in a focusable box', async () => {
    const html = await render('$$\nx = 1\n$$\n');
    expect(html).toMatch(
      /^<div class="formula" tabindex="0"><span class="katex"><math [^>]*display="block">/,
    );
    expect(html).not.toContain('<pre>');
  });

  it('puts the number of a tagged formula in its own cell', async () => {
    const html = await render('$$\nF = m a \\tag{12}\n$$\n');
    expect(html).toContain('<mtd><mtext>(12)</mtext></mtd>');
  });

  it('draws a paragraph of one $$ formula as a display formula', async () => {
    const html = await render('$$ F = m a \\tag{12}$$\n');
    expect(html).toMatch(/^<div class="formula" tabindex="0">/);
    expect(html).toContain('display="block"');
    expect(html).toContain('<mtd><mtext>(12)</mtext></mtd>');
  });

  it('keeps $$ inside running text and a lone $ formula inline', async () => {
    const html = await render('Text $$a$$ here.\n\n$b$\n');
    expect(html).not.toContain('formula');
    expect(html).not.toContain('display="block"');
  });

  it('marks a broken formula with katex-error and keeps its source', async () => {
    const html = await render('$\\frac{1}{$\n');
    expect(html).toContain('class="katex-error"');
    expect(html).toContain('\\frac{1}{');
  });

  it('keeps a dollar sign in code as code', async () => {
    const html = await render('`$x$` and\n\n```\n$$ y $$\n```\n');
    expect(html).toContain('<code>$x$</code>');
    expect(html).toContain('<pre><code>$$ y $$</code></pre>');
    expect(html).not.toContain('katex');
  });

  it('keeps a list as it is when one item has no arrow', async () => {
    const html = await render('- a → b\n- plain item\n');
    expect(html).not.toContain('fixes');
    expect(html).toContain('<li>a → b</li>');
  });
});
