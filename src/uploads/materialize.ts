import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { uploadDirectory } from './storage.js';

const runtimeDir = () => join(uploadDirectory(), 'runtime');

function extForMime(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  return '.jpg';
}

/**
 * Materialize a data-URI onto disk and return a public /uploads/runtime/... path
 * so older app builds (and <img> tags) can load it as a normal URL.
 */
export async function materializeDataImage(
  dataUrl: string,
  key: string,
): Promise<string | null> {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(
    dataUrl.trim(),
  );
  if (!match) return null;
  const mime = match[1];
  const b64 = match[2];
  const ext = extForMime(mime);
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 16);
  const filename = `${hash}${ext}`;
  const dir = runtimeDir();
  await mkdir(dir, { recursive: true });
  const full = join(dir, filename);
  try {
    await access(full);
  } catch {
    await writeFile(full, Buffer.from(b64, 'base64'));
  }
  return `/uploads/runtime/${filename}`;
}

export async function publicMediaUrl(
  url: string | null | undefined,
  key: string,
): Promise<string | null | undefined> {
  if (!url) return url;
  if (!url.startsWith('data:image/')) return url;
  return (await materializeDataImage(url, key)) ?? url;
}
