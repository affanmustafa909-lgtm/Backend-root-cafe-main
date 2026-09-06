import { createHash } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { uploadDirectory } from './storage.js';
import type { PrismaService } from '../prisma/prisma.service.js';

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
  // Content hash so re-uploads for the same product get a new URL (no stale cache).
  const hash = createHash('sha1').update(b64).digest('hex').slice(0, 20);
  const filename = `${hash}${ext}`;
  const dir = runtimeDir();
  await mkdir(dir, { recursive: true });
  const full = join(dir, filename);
  try {
    await access(full);
  } catch {
    await writeFile(full, Buffer.from(b64, 'base64'));
  }
  void key;
  return `/uploads/runtime/${filename}`;
}

/** Never return data: URIs to clients — always a fetchable /uploads path. */
export async function publicMediaUrl(
  url: string | null | undefined,
  key: string,
): Promise<string | null | undefined> {
  if (!url) return url;
  if (!url.startsWith('data:image/')) return url;
  return (await materializeDataImage(url, key)) ?? undefined;
}

/**
 * Warm /uploads/runtime from embedded data-URIs after deploy.
 * Keep data: values in the DB — rewriting to disk paths breaks on ephemeral hosts.
 */
export async function migrateEmbeddedImagesToDisk(prisma: PrismaService) {
  await mkdir(runtimeDir(), { recursive: true });

  const products = await prisma.product.findMany({
    where: { imageUrl: { startsWith: 'data:image/' } },
    select: { id: true, imageUrl: true },
  });
  for (const row of products) {
    await materializeDataImage(row.imageUrl!, `product:${row.id}`);
  }

  const settings = await prisma.appConfig.findMany({
    where: { homeBannerImageUrl: { startsWith: 'data:image/' } },
    select: { id: true, homeBannerImageUrl: true },
  });
  for (const row of settings) {
    await materializeDataImage(row.homeBannerImageUrl!, `banner:${row.id}`);
  }

  try {
    const slides = await prisma.onboardingSlide.findMany({
      where: { imageUrl: { startsWith: 'data:image/' } },
      select: { id: true, imageUrl: true },
    });
    for (const row of slides) {
      await materializeDataImage(row.imageUrl!, `onboarding:${row.id}`);
    }
  } catch {
    // schema may not have onboarding in older DBs
  }
}
