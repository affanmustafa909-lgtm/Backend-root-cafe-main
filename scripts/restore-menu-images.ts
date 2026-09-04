/**
 * Point catalog products back at bundled /uploads/menu/* files.
 * Railway's disk is ephemeral — admin UUID uploads disappear on redeploy.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { menuProducts } from '../prisma/menu-catalog.ts';

const prisma = new PrismaClient();

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
    const result = await prisma.product.updateMany({
      where: {
        id: def.id,
        OR: [{ imageUrl: null }, { NOT: { imageUrl } }],
      },
      data: { imageUrl },
    });
    updated += result.count;
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
