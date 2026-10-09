import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cardPng, cardSvg, wrap } from '../src/og';
import { OG_HEIGHT, OG_WIDTH } from '../src/seo';

const LOGO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="3"><rect width="10" height="3"/></svg>';

describe('wrap', () => {
  it('breaks at words within the width', () => {
    expect(wrap('one two three four', 9, 5)).toEqual([
      'one two',
      'three',
      'four',
    ]);
  });

  it('keeps a word longer than the width whole', () => {
    expect(wrap('supercalifragilistic word', 5, 5)).toEqual([
      'supercalifragilistic',
      'word',
    ]);
  });

  it('ends the last line with an ellipsis when text is left', () => {
    expect(wrap('one two three four.', 9, 2)).toEqual(['one two', 'three…']);
    expect(wrap('one two, three four', 8, 1)).toEqual(['one two…']);
  });
});

describe('card', () => {
  it('escapes the text', () => {
    const svg = cardSvg({
      heading: 'A <b> & "c"',
      text: 'x',
      version: '1',
      logo: LOGO,
    });
    expect(svg).toContain('A &lt;b&gt; &amp; &quot;c&quot;');
  });

  it('renders a PNG of the OpenGraph size', async () => {
    const png = await cardPng({
      heading: 'Title',
      text: 'Text.',
      version: '1.2.3',
      logo: LOGO,
    });
    const meta = await sharp(png).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual([
      'png',
      OG_WIDTH,
      OG_HEIGHT,
    ]);
  });
});
