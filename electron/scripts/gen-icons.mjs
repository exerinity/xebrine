import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const shell = join(dirname(fileURLToPath(import.meta.url)), '..');
const transparentSource = join(
  shell,
  '..',
  'public',
  'app',
  'media',
  'icon-512-transparent.png'
);
const out = join(shell, 'build');

if (!existsSync(transparentSource)) {
  console.error('fatal: desktop icon sources are missing');
  process.exit(1);
}

mkdirSync(out, { recursive: true });

copyFileSync(transparentSource, join(out, 'icon.png'));
console.log('wrote build/icon.png');

try {
  execFileSync('magick', [
    transparentSource,
    '-define',
    'icon:auto-resize=256,128,64,48,32,24,16',
    join(out, 'icon.ico')
  ]);
  console.log('wrote build/icon.ico');
} catch {
  console.warn('warn: fail run magick');
}
