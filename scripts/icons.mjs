import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

/**
 * The mark: two press plates and the slug between them. Compressed — the slug is
 * wider than it is tall, because it has already been pressed.
 */
const glyph = (paper, ink, signal, inset = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${paper}"/>
  <g transform="translate(256 256) scale(${1 - inset}) translate(-256 -256)">
    <rect x="96"  y="112" width="320" height="46" rx="3" fill="${ink}"/>
    <rect x="96"  y="354" width="320" height="46" rx="3" fill="${ink}"/>
    <rect x="156" y="224" width="200" height="64" rx="3" fill="${signal}"/>
  </g>
</svg>`;

const PAPER = '#F6F2EA', INK = '#171412', SIGNAL = '#B8442A';

await mkdir('public/icons', { recursive: true });
const any = Buffer.from(glyph(PAPER, INK, SIGNAL));
const maskable = Buffer.from(glyph(PAPER, INK, SIGNAL, 0.22));

for (const [name, src, size] of [
  ['icon-192.png', any, 192],
  ['icon-512.png', any, 512],
  ['maskable-192.png', maskable, 192],
  ['maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', any, 180],
]) {
  await sharp(src).resize(size, size).png().toFile(`public/icons/${name}`);
}
await writeFile('public/icons/favicon.svg', glyph(PAPER, INK, SIGNAL));
console.log('icons written');
