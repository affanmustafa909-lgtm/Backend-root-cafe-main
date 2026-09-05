/**
 * Re-embed admin UUID uploads that exist on local disk into the DB as durable
 * data-URIs so Railway (ephemeral disk) can still serve product photos.
 *
 * Usage: npx tsx scripts/embed-orphan-uploads.ts
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const prisma = new PrismaClient();
const uploadsRoot = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');

async function toDataUri(filePath: string): Promise<string> {
  const raw = await readFile(filePath);
  const jpeg = await sharp(raw)
    .rotate()
    .resize(900, 900, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      imageUrl: { startsWith: '/uploads/' },
      NOT: { imageUrl: { startsWith: '/uploads/menu/' } },
    },
    select: { id: true, name: true, imageUrl: true },
  });

  let fixed = 0;
  let skipped = 0;
  for (const product of products) {
    const relative = (product.imageUrl ?? '').replace(/^\/uploads\//, '');
    const filePath = join(uploadsRoot, relative);
    try {
      const dataUri = await toDataUri(filePath);
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: dataUri },
      });
      fixed += 1;
      console.log(`fixed: ${product.name} (${relative})`);
    } catch (error) {
      skipped += 1;
      console.warn(
        `skip: ${product.name} — ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(`Done. fixed=${fixed} skipped=${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
