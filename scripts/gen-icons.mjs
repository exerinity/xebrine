import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GLYPH = '𝇛';

const fontFile = execFileSync('fc-match', [':charset=1d1db', '-f', '%{file}'])
  .toString()
  .trim();
if (!fontFile) {
  console.error('fatal: no installed font covers');
  process.exit(1);
}
console.log(`rendering ${GLYPH} with ${fontFile}`);

mkdirSync(join(root, 'public'), { recursive: true });
for (const size of [192, 512]) {
  const glyphBox = Math.round(size * 0.64);
  execFileSync('magick', [
    '-size', `${size}x${size}`,
    'gradient:#2e1683-#4a29c2',
    '(',
    '-background', 'none',
    '-fill', '#ffffff',
    '-font', fontFile,
    '-pointsize', String(size),
    `label:${GLYPH}`,
    '-trim', '+repage',
    '-resize', `${glyphBox}x${glyphBox}`,
    ')',
    '-gravity', 'center',
    '-composite',
    join(root, 'public', `icon-${size}.png`)
  ]);
  console.log(`wrote public/icon-${size}.png`);
}
