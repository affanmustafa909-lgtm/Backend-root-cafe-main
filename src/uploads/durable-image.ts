import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const MAX_EDGE = 720;
const JPEG_QUALITY = 68;

/** Wider / sharper encode for home banner (landscape promo). */
const BANNER_MAX_WIDTH = 1600;
const BANNER_JPEG_QUALITY = 88;

/**
 * Persist an uploaded image in the DB as a compressed data-URI.
 * Railway (and similar) wipe local disk on redeploy — file-only paths break.
 * Clients still get /uploads/runtime/... via publicMediaUrl materialize.
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

  try {
    const jpeg = await sharp(source)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    const mime = file.mimetype?.startsWith('image/')
      ? file.mimetype
      : 'image/jpeg';
    return `data:${mime};base64,${source.toString('base64')}`;
  }
}

/** Higher-res encode so the home banner stays sharp on phone screens. */
export async function toStoredBannerImageUrl(
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

  try {
    const jpeg = await sharp(source)
      .rotate()
      .resize(BANNER_MAX_WIDTH, undefined, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: BANNER_JPEG_QUALITY,
        mozjpeg: true,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return toStoredImageUrl(file);
  }
}

export function isDurableImageUrl(url?: string | null): boolean {
  return !!url && /^data:image\//i.test(url.trim());
}
