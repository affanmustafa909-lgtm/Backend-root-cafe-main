/**
 * Point catalog products back at bundled /uploads/menu/* files.
 * Never overwrite durable admin uploads (data: / runtime / durable).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { menuProducts } from '../prisma/menu-catalog.ts';

const prisma = new PrismaClient();

function isProtectedImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith('data:') ||
    url.startsWith('/uploads/runtime/') ||
    url.startsWith('/uploads/durable/')
  );
}

async function main() {
  let updated = 0;
  let skipped = 0;

  for (const def of menuProducts) {
    if (!def.imageFile) {
      skipped += 1;
      continue;
    }

    const filePath = join(process.cwd(), 'uploads', 'menu', def.imageFile);
    if (!existsSync(filePath)) {
      console.warn(`Missing menu file for ${def.id}: ${def.imageFile}`);
      skipped += 1;
      continue;
    }

    const imageUrl = `/uploads/menu/${def.imageFile}`;
    const imageUrlHot = def.imageFileHot
      ? `/uploads/menu/${def.imageFileHot}`
      : undefined;
    const imageUrlCold = def.imageFileCold
      ? `/uploads/menu/${def.imageFileCold}`
      : undefined;

    const existing = await prisma.product.findUnique({
      where: { id: def.id },
      select: { imageUrl: true, imageUrlHot: true, imageUrlCold: true },
    });
    if (!existing) {
      skipped += 1;
      continue;
    }

    const data: {
      imageUrl?: string;
      imageUrlHot?: string | null;
      imageUrlCold?: string | null;
    } = {};

    if (!isProtectedImage(existing.imageUrl) && existing.imageUrl !== imageUrl) {
      data.imageUrl = imageUrl;
    }
    if (
      imageUrlHot &&
      !isProtectedImage(existing.imageUrlHot) &&
      existing.imageUrlHot !== imageUrlHot
    ) {
      data.imageUrlHot = imageUrlHot;
    }
    if (
      imageUrlCold &&
      !isProtectedImage(existing.imageUrlCold) &&
      existing.imageUrlCold !== imageUrlCold
    ) {
      data.imageUrlCold = imageUrlCold;
    }

    if (!Object.keys(data).length) {
      skipped += 1;
      continue;
    }

    await prisma.product.update({ where: { id: def.id }, data });
    updated += 1;
  }

  console.log(
    `Menu image restore complete — updated ${updated}, skipped ${skipped}`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
