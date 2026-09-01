import { Prisma, SelectionType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Standard options on every product: Size / Milk / Syrups. */
export const DEFAULT_CUSTOMIZATION_DEFS = [
  {
    id: 'seed-group-size',
    name: 'Size',
    sortOrder: 10,
    required: true,
    selectionType: SelectionType.SINGLE,
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
    selectionType: SelectionType.SINGLE,
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
    selectionType: SelectionType.SINGLE,
    options: [
      { id: 'seed-option-syrup-vanilla', name: 'Vanilla', sortOrder: 1 },
      { id: 'seed-option-syrup-caramel', name: 'Caramel', sortOrder: 2 },
      { id: 'seed-option-syrup-hazelnut', name: 'Hazelnut', sortOrder: 3 },
      { id: 'seed-option-syrup-white-choc', name: 'White Chocolate', sortOrder: 4 },
      { id: 'seed-option-syrup-cinnamon', name: 'Cinnamon', sortOrder: 5 },
    ],
  },
] as const;

const LEGACY_GROUP_IDS = [
  'seed-group-sugar',
  'seed-group-ice',
  'seed-group-super-ice-size',
  'seed-group-espresso',
] as const;

export async function ensureDefaultCustomizationCatalog(
  prisma: PrismaService,
) {
  for (const def of DEFAULT_CUSTOMIZATION_DEFS) {
    await prisma.customizationGroup.upsert({
      where: { id: def.id },
      update: {
        name: def.name,
        isActive: true,
        isRequired: def.required,
        selectionType: def.selectionType,
        sortOrder: def.sortOrder,
      },
      create: {
        id: def.id,
        name: def.name,
        isRequired: def.required,
        selectionType: def.selectionType,
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

  // Hide Small size if it still exists
  await prisma.customizationOption.updateMany({
    where: { id: 'seed-option-size-s' },
    data: { isActive: false, isAvailable: false },
  });

  // Retire legacy drink options
  await prisma.customizationGroup.updateMany({
    where: { id: { in: [...LEGACY_GROUP_IDS] } },
    data: { isActive: false },
  });
  await prisma.productCustomizationGroup.deleteMany({
    where: { groupId: { in: [...LEGACY_GROUP_IDS] } },
  });
}

export async function linkDefaultCustomizationsToProduct(
  prisma: PrismaService,
  productId: string,
) {
  for (const def of DEFAULT_CUSTOMIZATION_DEFS) {
    await prisma.productCustomizationGroup.upsert({
      where: {
        productId_groupId: { productId, groupId: def.id },
      },
      update: { sortOrder: def.sortOrder },
      create: {
        productId,
        groupId: def.id,
        sortOrder: def.sortOrder,
      },
    });
  }
  await prisma.productCustomizationGroup.deleteMany({
    where: {
      productId,
      groupId: { in: [...LEGACY_GROUP_IDS] },
    },
  });
}

export async function linkDefaultCustomizationsToAllProducts(
  prisma: PrismaService,
) {
  const products = await prisma.product.findMany({ select: { id: true } });
  for (const product of products) {
    await linkDefaultCustomizationsToProduct(prisma, product.id);
  }
}

let defaultsReady: Promise<void> | null = null;

/** Idempotent — every product gets Size / Milk / Syrups. */
export function ensureProductCustomizationDefaults(prisma: PrismaService) {
  if (!defaultsReady) {
    defaultsReady = (async () => {
      await ensureDefaultCustomizationCatalog(prisma);
      await linkDefaultCustomizationsToAllProducts(prisma);
    })().catch((err) => {
      defaultsReady = null;
      throw err;
    });
  }
  return defaultsReady;
}
