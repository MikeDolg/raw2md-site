import { describe, expect, it } from 'vitest';
import { home, inline, sectionLabel, splitSections } from '../src/home';

describe('home', () => {
  it('reads the hand-written parts of the home page', () => {
    expect(home.install).not.toBe('');
    expect(home.faq.length).toBeGreaterThan(0);
  });

  it('splits the intro from the level-2 sections', () => {
    const html =
      '<p>Intro</p>\n<h2 id="one">One</h2>\n<p>A</p>\n<h3 id="sub">Sub</h3>\n<h2 id="two">Two</h2>\n<p>B</p>';
    const { intro, sections } = splitSections(html);
    expect(intro).toBe('<p>Intro</p>\n');
    expect(sections.map((s) => s.id)).toEqual(['one', 'two']);
    expect(sections[0]?.html).toContain('<h3 id="sub">');
  });

  it('fails on a level-2 heading without an id', () => {
    expect(() => splitSections('<h2>Bare</h2>')).toThrow('without an id');
  });

  it('finds a label whatever the apostrophe', () => {
    const [heading] = Object.keys(home.labels);
    if (heading === undefined) throw new Error('home.yaml has no labels');
    const curly = heading.replace(/'/g, '’');
    expect(sectionLabel(curly)).toBe(home.labels[heading]);
  });

  it('fails on a section that has no label', () => {
    expect(() => sectionLabel('A heading nobody wrote')).toThrow('no label');
  });

  it('escapes hand-written text and keeps code spans', () => {
    expect(inline('Use `a<b>` & "c"')).toBe(
      'Use <code>a&lt;b&gt;</code> &amp; &quot;c&quot;',
    );
  });
});
