/**
 * Materialize durable data-URI images onto /uploads/runtime so static serving works
 * after Railway redeploys wipe the disk.
 *
 * Usage: npx tsx scripts/hydrate-runtime-images.ts
 */
import { createHash } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const uploadsRoot = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
const runtimeDir = join(uploadsRoot, 'runtime');

async function materialize(dataUrl: string, key: string): Promise<string | null> {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mime = match[1];
  const ext = mime.includes('png')
    ? '.png'
    : mime.includes('webp')
      ? '.webp'
      : '.jpg';
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 16);
  const filename = `${hash}${ext}`;
  await mkdir(runtimeDir, { recursive: true });
  const full = join(runtimeDir, filename);
  try {
    await access(full);
  } catch {
    await writeFile(full, Buffer.from(match[2], 'base64'));
  }
  return `/uploads/runtime/${filename}`;
}

async function main() {
  let count = 0;

  for (const p of await prisma.product.findMany({
    where: { imageUrl: { startsWith: 'data:image/' } },
    select: { id: true, imageUrl: true },
  })) {
    if (p.imageUrl && (await materialize(p.imageUrl, `product:${p.id}`))) count += 1;
  }

  for (const s of await prisma.onboardingSlide.findMany({
    where: { imageUrl: { startsWith: 'data:image/' } },
    select: { id: true, imageUrl: true },
  })) {
    if (s.imageUrl && (await materialize(s.imageUrl, `onboarding:${s.id}`)))
      count += 1;
  }

  const cfg = await prisma.appConfig.findFirst({
    select: { id: true, homeBannerImageUrl: true },
  });
  if (cfg?.homeBannerImageUrl?.startsWith('data:image/')) {
    if (await materialize(cfg.homeBannerImageUrl, `banner:${cfg.id}`)) count += 1;
  }

  for (const u of await prisma.user.findMany({
    where: { avatarUrl: { startsWith: 'data:image/' } },
    select: { id: true, avatarUrl: true },
  })) {
    if (u.avatarUrl && (await materialize(u.avatarUrl, `avatar:${u.id}`))) count += 1;
  }

  console.log(`hydrate-runtime-images: materialized ${count} file(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
