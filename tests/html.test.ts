import { markdownToHtml } from 'satteri';
import { describe, expect, it } from 'vitest';
import { siteHtml } from '../src/pipeline/html';

async function render(markdown: string): Promise<string> {
  const { html } = await markdownToHtml(markdown, {
    hastPlugins: [siteHtml],
    features: { gfm: true },
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

  it('keeps a list as it is when one item has no arrow', async () => {
    const html = await render('- a → b\n- plain item\n');
    expect(html).not.toContain('fixes');
    expect(html).toContain('<li>a → b</li>');
  });
});
