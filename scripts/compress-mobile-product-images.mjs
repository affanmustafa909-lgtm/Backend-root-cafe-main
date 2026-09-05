import sharp from 'sharp';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir =
  process.argv[2] ??
  join(
    process.cwd(),
    '..',
    'root-cafe-mobile-app',
    'src',
    'assets',
    'products',
  );

let saved = 0;
let n = 0;

for (const f of await readdir(dir)) {
  if (!/\.jpe?g$/i.test(f)) continue;
  const full = join(dir, f);
  const before = (await stat(full)).size;
  const out = await sharp(full)
    .rotate()
    .resize(860, 860, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
  if (out.length < before) {
    await writeFile(full, out);
    saved += before - out.length;
    n += 1;
  }
}

console.log(
  `compressed ${n} jpgs, saved ${(saved / 1024 / 1024).toFixed(1)} MB`,
);
