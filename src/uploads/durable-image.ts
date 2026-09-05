import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { uploadDirectory } from './storage.js';

const MAX_EDGE = 900;
const JPEG_QUALITY = 72;

/**
 * Persist an uploaded image so it survives Railway redeploys.
 * Compresses to JPEG and stores a data-URI in the DB (disk copy kept for local/static).
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

  let jpeg: Buffer;
  try {
    jpeg = await sharp(source)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    // Non-decodable / already tiny — fall back to raw bytes if small enough
    if (source.length <= 180_000) {
      const mime = file.mimetype || 'image/jpeg';
      return `data:${mime};base64,${source.toString('base64')}`;
    }
    return `/uploads/${file.filename}`;
  }

  const durableDir = join(uploadDirectory(), 'durable');
  await mkdir(durableDir, { recursive: true });
  const name = `${randomUUID()}.jpg`;
  await writeFile(join(durableDir, name), jpeg);

  // Prefer data URI so live API keeps the image even when disk is wiped.
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

export function isDurableImageUrl(url?: string | null): boolean {
  return !!url && /^data:image\//i.test(url.trim());
}
