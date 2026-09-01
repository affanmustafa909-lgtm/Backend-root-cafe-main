import { PrismaClient, SelectionType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { id: 'seed-cat-1', name: 'Hot Drinks', description: 'Espresso classics & steamed specialties', sortOrder: 1 },
  { id: 'seed-cat-5', name: 'Cold Drinks', description: 'Iced coffee & chilled favorites', sortOrder: 2 },
  { id: 'seed-cat-2', name: 'Matcha', description: 'Ceremonial grade matcha drinks', sortOrder: 3 },
  { id: 'seed-cat-4', name: 'Milkshakes', description: 'Thick, creamy shakes', sortOrder: 4 },
  { id: 'seed-cat-6', name: 'Protein Drinks', description: 'High-protein café blends', sortOrder: 5 },
  { id: 'seed-cat-9', name: 'Toasties', description: 'Toasted sandwiches & savory bites', sortOrder: 6 },
  { id: 'seed-cat-8', name: 'Mojitos', description: 'Fresh mint coolers', sortOrder: 7 },
] as const;

const activeIds = categories.map((c) => c.id);

const groups = [
  {
    id: 'seed-group-size',
    name: 'Size',
    sortOrder: 10,
    required: true,
    options: [
      { id: 'seed-option-size-m', name: 'Medium', sortOrder: 1 },
      { id: 'seed-option-size-l', name: 'Large', sortOrder: 2 },
    ],
  },
  {
    id: 'seed-group-milk',
    name: 'Milk',
    sortOrder: 11,
    required: true,
    options: [
      { id: 'seed-option-dairy', name: 'Cow Milk', sortOrder: 1 },
      { id: 'seed-option-coconut', name: 'Coconut Milk', sortOrder: 2 },
      { id: 'seed-option-oat', name: 'Oat Milk', sortOrder: 3 },
      { id: 'seed-option-almond', name: 'Almond Milk', sortOrder: 4 },
    ],
  },
  {
    id: 'seed-group-syrups',
    name: 'Syrups',
    sortOrder: 12,
    required: false,
    options: [
      { id: 'seed-option-syrup-vanilla', name: 'Vanilla', sortOrder: 1 },
      { id: 'seed-option-syrup-caramel', name: 'Caramel', sortOrder: 2 },
      { id: 'seed-option-syrup-hazelnut', name: 'Hazelnut', sortOrder: 3 },
      { id: 'seed-option-syrup-white-choc', name: 'White Chocolate', sortOrder: 4 },
      { id: 'seed-option-syrup-cinnamon', name: 'Cinnamon', sortOrder: 5 },
    ],
  },
] as const;

const legacyGroups = [
  'seed-group-sugar',
  'seed-group-ice',
  'seed-group-super-ice-size',
  'seed-group-espresso',
];

async function main() {
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
      create: {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
      },
    });
  }

  await prisma.category.updateMany({
    where: { id: { notIn: [...activeIds] } },
    data: { isActive: false },
  });

  // Remap products from retired categories onto the closest active ones
  const remaps: [string, string][] = [
    ['seed-cat-3', 'seed-cat-8'], // Frappes → Mojitos
    ['seed-cat-7', 'seed-cat-1'], // Tea → Hot Drinks
  ];
  for (const [from, to] of remaps) {
    await prisma.product.updateMany({
      where: { categoryId: from },
      data: { categoryId: to },
    });
  }

  for (const def of groups) {
    await prisma.customizationGroup.upsert({
      where: { id: def.id },
      update: {
        name: def.name,
        isActive: true,
        isRequired: def.required,
        selectionType: SelectionType.SINGLE,
        sortOrder: def.sortOrder,
      },
      create: {
        id: def.id,
        name: def.name,
        isRequired: def.required,
        selectionType: SelectionType.SINGLE,
        sortOrder: def.sortOrder,
      },
    });
    for (const opt of def.options) {
      await prisma.customizationOption.upsert({
        where: { id: opt.id },
        update: {
          name: opt.name,
          groupId: def.id,
          additionalPrice: new Prisma.Decimal(0),
          sortOrder: opt.sortOrder,
          isActive: true,
          isAvailable: true,
        },
        create: {
          id: opt.id,
          groupId: def.id,
          name: opt.name,
          additionalPrice: new Prisma.Decimal(0),
          sortOrder: opt.sortOrder,
        },
      });
    }
  }

  await prisma.customizationOption.updateMany({
    where: { id: 'seed-option-size-s' },
    data: { isActive: false, isAvailable: false },
  });

  await prisma.customizationGroup.updateMany({
    where: { id: { in: legacyGroups } },
    data: { isActive: false },
  });
  await prisma.productCustomizationGroup.deleteMany({
    where: { groupId: { in: legacyGroups } },
  });

  const products = await prisma.product.findMany({ select: { id: true } });
  for (const p of products) {
    for (const def of groups) {
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

  console.log(
    `Updated ${categories.length} categories, linked Size/Milk/Syrups to ${products.length} products`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
