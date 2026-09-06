import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { uploadDirectory } from './storage.js';

const MAX_EDGE = 720;
const JPEG_QUALITY = 68;

/**
 * Persist an uploaded image as a normal /uploads/durable/*.jpg file.
 * Fast for clients — no base64-in-DB and no per-request materialize.
 */
export async function toStoredImageUrl(
  file: Express.Multer.File,
): Promise<string> {
  const source = file.path
    ? await readFile(file.path)
    : file.buffer
      ? Buffer.from(file.buffer)
      : null;
  if (!source?.length) {
    return `/uploads/${file.filename}`;
  }

  const durableDir = join(uploadDirectory(), 'durable');
  await mkdir(durableDir, { recursive: true });
  const name = `${randomUUID()}.jpg`;
  const full = join(durableDir, name);

  try {
    const jpeg = await sharp(source)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    await writeFile(full, jpeg);
  } catch {
    await writeFile(full, source);
  }

  return `/uploads/durable/${name}`;
}

export function isDurableImageUrl(url?: string | null): boolean {
  return !!url && /^data:image\//i.test(url.trim());
}
