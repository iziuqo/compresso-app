import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

/**
 * The mark: a circle held between two plates, and flattened.
 *
 * Three white shapes on black — no gradient, no container, nothing to explain.
 * Checked at 16px before it was chosen: the plate rules survive there, which is
 * what makes it read as *compressed* rather than as a generic ellipse. The same
 * glyph runs in the header, where the disc arrives round and settles flat while
 * the plates hold still.
 */
const glyph = (ground, ink, k = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${ground}"/>
  <g transform="translate(256 256) scale(${k}) translate(-256 -256)">
    <rect x="112" y="146" width="288" height="9" rx="4.5" fill="${ink}"/>
    <ellipse cx="256" cy="256" rx="120" ry="55" fill="${ink}"/>
    <rect x="112" y="357" width="288" height="9" rx="4.5" fill="${ink}"/>
  </g>
</svg>`;

const BLACK = '#000000', WHITE = '#FFFFFF';

await mkdir('public/icons', { recursive: true });

const full = Buffer.from(glyph(BLACK, WHITE));
// maskable icons get cropped to a circle by the OS, so the mark pulls in
const maskable = Buffer.from(glyph(BLACK, WHITE, 0.72));

for (const [name, src, size] of [
  ['icon-192.png', full, 192],
  ['icon-512.png', full, 512],
  ['maskable-192.png', maskable, 192],
  ['maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', full, 180],
]) {
  await sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
}

await writeFile('public/icons/favicon.svg', glyph(BLACK, WHITE).trim() + '\n');
console.log('icons written');
