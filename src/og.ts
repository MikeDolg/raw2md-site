import sharp from 'sharp';
import { OG_HEIGHT, OG_WIDTH } from './seo';

const PAD = 80;
const MONO = "'DejaVu Sans Mono', Consolas, Menlo, monospace";
const SANS = "'DejaVu Sans', 'Segoe UI', Arial, sans-serif";
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

export interface Card {
  heading: string;
  text: string;
  version: string;
  /** The logo as SVG source. */
  logo: string;
}

function escape(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
}

/** Splits `text` into lines of `width` characters at most; the last line ends with an ellipsis when text is left. */
export function wrap(text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  const words = text.split(/\s+/).filter(Boolean);
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width || !line) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      lines.push(`${line.replace(/[.,;:]$/, '')}…`);
      return lines;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function textLines(
  lines: string[],
  y: number,
  size: number,
  leading: number,
  attrs: string,
): string {
  return lines
    .map(
      (line, i) =>
        `<text x="${PAD}" y="${y + i * leading}" font-size="${size}" ${attrs}>${escape(line)}</text>`,
    )
    .join('');
}

/** The OpenGraph card of a page as SVG, in the dark colors of the site. */
export function cardSvg(card: Card): string {
  const logo = Buffer.from(card.logo).toString('base64');
  const heading = wrap(card.heading, 26, 2);
  const textTop = 300 + heading.length * 78;
  const footY = OG_HEIGHT - PAD + 10;
  const room = Math.floor((footY - 60 - textTop) / 42) + 1;
  const text = wrap(card.text, 58, room);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">`,
    `<rect width="100%" height="100%" fill="#0d0f13"/>`,
    `<image x="${PAD}" y="${PAD}" width="320" height="84" href="data:image/svg+xml;base64,${logo}"/>`,
    `<rect x="${PAD}" y="210" width="${OG_WIDTH - 2 * PAD}" height="2" fill="#2e333d"/>`,
    textLines(
      heading,
      300,
      64,
      78,
      `font-family="${MONO}" font-weight="700" fill="#e6e8ec"`,
    ),
    textLines(text, textTop, 30, 42, `font-family="${SANS}" fill="#9ba2ae"`),
    `<text x="${PAD}" y="${footY}" font-size="28" font-family="${MONO}" fill="#74b0ff">raw2md.com</text>`,
    `<text x="${OG_WIDTH - PAD}" y="${footY}" font-size="28" font-family="${MONO}" fill="#9ba2ae" text-anchor="end">raw2md ${escape(card.version)}</text>`,
    '</svg>',
  ].join('');
}

export async function cardPng(card: Card): Promise<Uint8Array<ArrayBuffer>> {
  const png = await sharp(Buffer.from(cardSvg(card)))
    .png()
    .toBuffer();
  return new Uint8Array(png);
}
