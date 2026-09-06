import { createHash } from 'node:crypto';
import { mkdir, writeFile, access, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { uploadDirectory } from './storage.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const runtimeDir = () => join(uploadDirectory(), 'runtime');
const durableDir = () => join(uploadDirectory(), 'durable');

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
 * One-shot: rewrite data-URI columns to /uploads/durable files so list APIs stay fast.
 */
export async function migrateEmbeddedImagesToDisk(prisma: PrismaService) {
  await mkdir(durableDir(), { recursive: true });
  await mkdir(runtimeDir(), { recursive: true });

  const products = await prisma.product.findMany({
    where: { imageUrl: { startsWith: 'data:image/' } },
    select: { id: true, imageUrl: true },
  });
  for (const row of products) {
    const path = await materializeDataImage(row.imageUrl!, `product:${row.id}`);
    if (!path) continue;
    const runtimeFile = join(uploadDirectory(), path.replace(/^\//, '').replace(/^uploads\//, ''));
    const durableName = `${row.id.replace(/[^a-zA-Z0-9_-]/g, '')}.jpg`;
    const durablePath = join(durableDir(), durableName);
    try {
      await copyFile(runtimeFile, durablePath);
      await prisma.product.update({
        where: { id: row.id },
        data: { imageUrl: `/uploads/durable/${durableName}` },
      });
    } catch {
      await prisma.product.update({
        where: { id: row.id },
        data: { imageUrl: path },
      });
    }
  }

  const settings = await prisma.appConfig.findMany({
    where: { homeBannerImageUrl: { startsWith: 'data:image/' } },
    select: { id: true, homeBannerImageUrl: true },
  });
  for (const row of settings) {
    const path = await materializeDataImage(
      row.homeBannerImageUrl!,
      `banner:${row.id}`,
    );
    if (path) {
      await prisma.appConfig.update({
        where: { id: row.id },
        data: { homeBannerImageUrl: path },
      });
    }
  }

  try {
    const slides = await prisma.onboardingSlide.findMany({
      where: { imageUrl: { startsWith: 'data:image/' } },
      select: { id: true, imageUrl: true },
    });
    for (const row of slides) {
      const path = await materializeDataImage(
        row.imageUrl!,
        `onboarding:${row.id}`,
      );
      if (path) {
        await prisma.onboardingSlide.update({
          where: { id: row.id },
          data: { imageUrl: path },
        });
      }
    }
  } catch {
    // schema may not have onboarding in older DBs
  }
}
