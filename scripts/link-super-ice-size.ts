import { PrismaClient, SelectionType } from '@prisma/client';

const prisma = new PrismaClient();

const defs = [
  {
    id: 'seed-group-size',
    name: 'Size',
    sortOrder: 10,
    options: [
      { id: 'seed-option-size-s', name: 'Small', sortOrder: 1 },
      { id: 'seed-option-size-m', name: 'Medium', sortOrder: 2 },
      { id: 'seed-option-size-l', name: 'Large', sortOrder: 3 },
    ],
  },
  {
    id: 'seed-group-sugar',
    name: 'Sugar',
    sortOrder: 11,
    options: [
      { id: 'seed-option-sugar-normal', name: 'Normal', sortOrder: 1 },
      { id: 'seed-option-sugar-less', name: 'Less', sortOrder: 2 },
      { id: 'seed-option-sugar-no', name: 'No', sortOrder: 3 },
    ],
  },
  {
    id: 'seed-group-ice',
    name: 'Ice',
    sortOrder: 12,
    options: [
      { id: 'seed-option-ice-normal', name: 'Normal', sortOrder: 1 },
      { id: 'seed-option-ice-less', name: 'Less', sortOrder: 2 },
      { id: 'seed-option-ice-no', name: 'No', sortOrder: 3 },
    ],
  },
  {
    id: 'seed-group-super-ice-size',
    name: 'Super Ice Size',
    sortOrder: 13,
    options: [
      { id: 'seed-option-super-ice-s', name: 'Small', sortOrder: 1 },
      { id: 'seed-option-super-ice-m', name: 'Medium', sortOrder: 2 },
      { id: 'seed-option-super-ice-l', name: 'Large', sortOrder: 3 },
    ],
  },
] as const;

async function main() {
  for (const def of defs) {
    await prisma.customizationGroup.upsert({
      where: { id: def.id },
      update: {
        name: def.name,
        isActive: true,
        isRequired: true,
        selectionType: SelectionType.SINGLE,
        sortOrder: def.sortOrder,
      },
      create: {
        id: def.id,
        name: def.name,
        isRequired: true,
        selectionType: SelectionType.SINGLE,
        sortOrder: def.sortOrder,
      },
    });
    for (const opt of def.options) {
      await prisma.customizationOption.upsert({
        where: { id: opt.id },
        update: {
          name: opt.name,
          additionalPrice: 0,
          sortOrder: opt.sortOrder,
          isActive: true,
          isAvailable: true,
        },
        create: {
          id: opt.id,
          groupId: def.id,
          name: opt.name,
          additionalPrice: 0,
          sortOrder: opt.sortOrder,
        },
      });
    }
  }

  const products = await prisma.product.findMany({ select: { id: true } });
  for (const p of products) {
    for (const def of defs) {
      await prisma.productCustomizationGroup.upsert({
        where: {
          productId_groupId: { productId: p.id, groupId: def.id },
        },
        update: { sortOrder: def.sortOrder },
        create: {
          productId: p.id,
          groupId: def.id,
          sortOrder: def.sortOrder,
        },
      });
    }
  }

  console.log(`Linked Super Ice Size to ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
