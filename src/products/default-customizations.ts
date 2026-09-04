import { Prisma, SelectionType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';

type OptionDef = {
  id: string;
  name: string;
  sortOrder: number;
  additionalPrice: number;
};

type GroupDef = {
  id: string;
  name: string;
  sortOrder: number;
  required: boolean;
  selectionType: SelectionType;
  options: OptionDef[];
};

/** Categories that get Hot / Cold before checkout. */
export const TEMPERATURE_CATEGORY_IDS = new Set([
  'menu-cat-matcha',
  'menu-cat-protein',
]);

/** Standard options on every drink product. */
export const DEFAULT_CUSTOMIZATION_DEFS: GroupDef[] = [
  {
    id: 'seed-group-size',
    name: 'Size',
    sortOrder: 10,
    required: true,
    selectionType: SelectionType.SINGLE,
    options: [
      { id: 'seed-option-size-m', name: 'Medium', sortOrder: 1, additionalPrice: 0 },
      { id: 'seed-option-size-l', name: 'Large', sortOrder: 2, additionalPrice: 1 },
    ],
  },
  {
    id: 'seed-group-milk',
    name: 'Milk',
    sortOrder: 11,
    required: true,
    selectionType: SelectionType.SINGLE,
    options: [
      { id: 'seed-option-dairy', name: 'Cow Milk', sortOrder: 1, additionalPrice: 0 },
      { id: 'seed-option-coconut', name: 'Coconut Milk', sortOrder: 2, additionalPrice: 0.5 },
      { id: 'seed-option-oat', name: 'Oat Milk', sortOrder: 3, additionalPrice: 0.5 },
      { id: 'seed-option-almond', name: 'Almond Milk', sortOrder: 4, additionalPrice: 0.5 },
    ],
  },
  {
    id: 'seed-group-syrups',
    name: 'Syrups',
    sortOrder: 12,
    required: false,
    selectionType: SelectionType.SINGLE,
    options: [
      { id: 'seed-option-syrup-none', name: 'No Syrup', sortOrder: 0, additionalPrice: 0 },
      { id: 'seed-option-syrup-vanilla', name: 'Vanilla', sortOrder: 1, additionalPrice: 0.5 },
      { id: 'seed-option-syrup-caramel', name: 'Caramel', sortOrder: 2, additionalPrice: 0.5 },
      { id: 'seed-option-syrup-hazelnut', name: 'Hazelnut', sortOrder: 3, additionalPrice: 0.5 },
      { id: 'seed-option-syrup-white-choc', name: 'White Chocolate', sortOrder: 4, additionalPrice: 0.5 },
      { id: 'seed-option-syrup-cinnamon', name: 'Cinnamon', sortOrder: 5, additionalPrice: 0.5 },
    ],
  },
  {
    id: 'seed-group-whipped-cream',
    name: 'Whipped Cream',
    sortOrder: 13,
    required: false,
    selectionType: SelectionType.SINGLE,
    options: [
      { id: 'seed-option-no-whipped', name: 'None', sortOrder: 1, additionalPrice: 0 },
      {
        id: 'seed-option-whipped',
        name: 'Whipped Cream',
        sortOrder: 2,
        additionalPrice: 0.5,
      },
    ],
  },
];

export const TEMPERATURE_GROUP: GroupDef = {
  id: 'seed-group-temperature',
  name: 'Temperature',
  sortOrder: 5,
  required: true,
  selectionType: SelectionType.SINGLE,
  options: [
    { id: 'seed-option-temp-hot', name: 'Hot', sortOrder: 1, additionalPrice: 0 },
    { id: 'seed-option-temp-cold', name: 'Cold', sortOrder: 2, additionalPrice: 0 },
  ],
};

const LEGACY_GROUP_IDS = [
  'seed-group-sugar',
  'seed-group-ice',
  'seed-group-super-ice-size',
  'seed-group-espresso',
] as const;

const ALL_GROUP_DEFS = [...DEFAULT_CUSTOMIZATION_DEFS, TEMPERATURE_GROUP];

async function upsertGroup(prisma: PrismaService, def: GroupDef) {
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
        additionalPrice: new Prisma.Decimal(opt.additionalPrice),
        sortOrder: opt.sortOrder,
        isActive: true,
        isAvailable: true,
      },
      create: {
        id: opt.id,
        groupId: def.id,
        name: opt.name,
        additionalPrice: new Prisma.Decimal(opt.additionalPrice),
        sortOrder: opt.sortOrder,
      },
    });
  }
}

export async function ensureDefaultCustomizationCatalog(
  prisma: PrismaService,
) {
  for (const def of ALL_GROUP_DEFS) {
    await upsertGroup(prisma, def);
  }

  await prisma.customizationOption.updateMany({
    where: { id: 'seed-option-size-s' },
    data: { isActive: false, isAvailable: false },
  });

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
  categoryId?: string | null,
) {
  let catId = categoryId;
  if (!catId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });
    catId = product?.categoryId ?? null;
  }

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

  const wantsTemperature = catId && TEMPERATURE_CATEGORY_IDS.has(catId);
  if (wantsTemperature) {
    await prisma.productCustomizationGroup.upsert({
      where: {
        productId_groupId: { productId, groupId: TEMPERATURE_GROUP.id },
      },
      update: { sortOrder: TEMPERATURE_GROUP.sortOrder },
      create: {
        productId,
        groupId: TEMPERATURE_GROUP.id,
        sortOrder: TEMPERATURE_GROUP.sortOrder,
      },
    });
  } else {
    await prisma.productCustomizationGroup.deleteMany({
      where: { productId, groupId: TEMPERATURE_GROUP.id },
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
  const products = await prisma.product.findMany({
    select: { id: true, categoryId: true },
  });
  for (const product of products) {
    await linkDefaultCustomizationsToProduct(
      prisma,
      product.id,
      product.categoryId,
    );
  }
}

let defaultsReady: Promise<void> | null = null;

/** Idempotent — every product gets Size / Milk / Syrups / Whipped Cream (+ Temperature for matcha & protein). */
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
