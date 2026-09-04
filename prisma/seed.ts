import {
  OrderStatus,
  PaymentStatus,
  PickupType,
  PrismaClient,
  Role,
  SelectionType,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { menuCategories, menuProducts } from './menu-catalog.js';

function loadDotEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // .env optional when vars are already in the environment
  }
}
loadDotEnv();

const prisma = new PrismaClient();
const password = process.env.SEED_PASSWORD;
if (!password) throw new Error('SEED_PASSWORD is required');
const passwordHash = await bcrypt.hash(password, 12);

const seedUsers: [string, string, string, Role][] = [
  ['seed-manager', 'manager@rootscafe.local', 'Roots Manager', Role.MANAGER],
  ['seed-staff', 'staff@rootscafe.local', 'Roots Staff', Role.STAFF],
  [
    'seed-customer',
    'customer@rootscafe.local',
    'Sample Customer',
    Role.CUSTOMER,
  ],
];

const users = await Promise.all(
  seedUsers.map(([id, email, name, role]) =>
    prisma.user.upsert({
      where: { email },
      update: { passwordHash, name, role },
      create: { id, email, passwordHash, name, role, phone: '+353871234567' },
    }),
  ),
);
const customer = users[2];

// Deactivate all products not in the official menu catalog
const menuIds = menuProducts.map((p) => p.id);
await prisma.product.updateMany({
  where: { id: { notIn: menuIds } },
  data: { isActive: false, isSoldOut: true },
});
await prisma.category.updateMany({
  where: { id: { startsWith: 'seed-cat-' } },
  data: { isActive: false },
});

const categories = await Promise.all(
  menuCategories.map((cat) =>
    prisma.category.upsert({
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
    }),
  ),
);

const byCategoryId = Object.fromEntries(categories.map((c) => [c.id, c]));

const products = [];
for (const def of menuProducts) {
  const category = byCategoryId[def.categoryId];
  if (!category) throw new Error(`Missing category ${def.categoryId}`);
  const imageUrl = def.imageFile ? `/uploads/menu/${def.imageFile}` : null;
  const product = await prisma.product.upsert({
    where: { id: def.id },
    update: {
      name: def.name,
      description: def.description,
      price: def.price,
      categoryId: category.id,
      imageUrl,
      allergens: def.allergens ?? null,
      sortOrder: def.sortOrder,
      isActive: true,
      isSoldOut: false,
      isTopSale: false,
      discountPercent: null,
      compareAtPrice: null,
    },
    create: {
      id: def.id,
      name: def.name,
      description: def.description,
      price: def.price,
      categoryId: category.id,
      imageUrl,
      allergens: def.allergens,
      sortOrder: def.sortOrder,
    },
  });
  products.push(product);
}

const latte = products.find((p) => p.id === 'menu-latte')!;
const cappuccino = products.find((p) => p.id === 'menu-cappuccino')!;
const matchaLatte = products.find((p) => p.id === 'menu-matcha-latte')!;
const icedLatteMacchiato = products.find((p) => p.id === 'menu-iced-latte-macchiato')!;
const chai = products.find((p) => p.id === 'menu-chai-latte')!;

const milk = await prisma.customizationGroup.upsert({
  where: { id: 'seed-group-milk' },
  update: { name: 'Milk Type', isActive: true },
  create: {
    id: 'seed-group-milk',
    name: 'Milk Type',
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 1,
  },
});

const espresso = await prisma.customizationGroup.upsert({
  where: { id: 'seed-group-espresso' },
  update: { name: 'Extra Espresso', isActive: true },
  create: {
    id: 'seed-group-espresso',
    name: 'Extra Espresso',
    selectionType: SelectionType.SINGLE,
    sortOrder: 2,
  },
});

await prisma.customizationOption.upsert({
  where: { id: 'seed-option-dairy' },
  update: { name: 'Regular', additionalPrice: 0 },
  create: {
    id: 'seed-option-dairy',
    groupId: milk.id,
    name: 'Regular',
    additionalPrice: 0,
    sortOrder: 1,
  },
});

const oat = await prisma.customizationOption.upsert({
  where: { id: 'seed-option-oat' },
  update: { name: 'Oat Milk', additionalPrice: 0.5 },
  create: {
    id: 'seed-option-oat',
    groupId: milk.id,
    name: 'Oat Milk',
    additionalPrice: 0.5,
    sortOrder: 2,
  },
});

await prisma.customizationOption.upsert({
  where: { id: 'seed-option-almond' },
  update: { name: 'Almond Milk', additionalPrice: 0.5 },
  create: {
    id: 'seed-option-almond',
    groupId: milk.id,
    name: 'Almond Milk',
    additionalPrice: 0.5,
    sortOrder: 3,
  },
});

await prisma.customizationOption.upsert({
  where: { id: 'seed-option-shot' },
  update: { name: '1 Shot', additionalPrice: 0.8 },
  create: {
    id: 'seed-option-shot',
    groupId: espresso.id,
    name: '1 Shot',
    additionalPrice: 0.8,
    sortOrder: 1,
  },
});

// Whipped Cream — available on ALL drinks for €0.50
const whippedCream = await prisma.customizationGroup.upsert({
  where: { id: 'seed-group-whipped-cream' },
  update: { name: 'Whipped Cream', isActive: true },
  create: {
    id: 'seed-group-whipped-cream',
    name: 'Whipped Cream',
    selectionType: SelectionType.SINGLE,
    isRequired: false,
    sortOrder: 3,
  },
});
await prisma.customizationOption.upsert({
  where: { id: 'seed-option-no-whipped' },
  update: { name: 'None', additionalPrice: 0 },
  create: { id: 'seed-option-no-whipped', groupId: whippedCream.id, name: 'None', additionalPrice: 0, sortOrder: 1 },
});
await prisma.customizationOption.upsert({
  where: { id: 'seed-option-whipped' },
  update: { name: 'Whipped Cream', additionalPrice: 0.50 },
  create: { id: 'seed-option-whipped', groupId: whippedCream.id, name: 'Whipped Cream', additionalPrice: 0.50, sortOrder: 2 },
});

// Attach whipped cream to ALL drinks
for (const product of products) {
  await prisma.productCustomizationGroup.upsert({
    where: { productId_groupId: { productId: product.id, groupId: whippedCream.id } },
    update: { sortOrder: 3 },
    create: { productId: product.id, groupId: whippedCream.id, sortOrder: 3 },
  });
}

const milkProducts = [latte, matchaLatte, cappuccino, icedLatteMacchiato, chai];
for (const product of milkProducts) {
  await prisma.productCustomizationGroup.upsert({
    where: { productId_groupId: { productId: product.id, groupId: milk.id } },
    update: { sortOrder: 1 },
    create: { productId: product.id, groupId: milk.id, sortOrder: 1 },
  });
}

for (const product of [latte, cappuccino, icedLatteMacchiato]) {
  await prisma.productCustomizationGroup.upsert({
    where: {
      productId_groupId: { productId: product.id, groupId: espresso.id },
    },
    update: { sortOrder: 2 },
    create: { productId: product.id, groupId: espresso.id, sortOrder: 2 },
  });
}

const size = await prisma.customizationGroup.upsert({
  where: { id: 'seed-group-size' },
  update: {
    name: 'Size',
    isActive: true,
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 10,
  },
  create: {
    id: 'seed-group-size',
    name: 'Size',
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 10,
  },
});
const sugar = await prisma.customizationGroup.upsert({
  where: { id: 'seed-group-sugar' },
  update: {
    name: 'Sugar',
    isActive: true,
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 11,
  },
  create: {
    id: 'seed-group-sugar',
    name: 'Sugar',
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 11,
  },
});
const ice = await prisma.customizationGroup.upsert({
  where: { id: 'seed-group-ice' },
  update: {
    name: 'Ice',
    isActive: true,
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 12,
  },
  create: {
    id: 'seed-group-ice',
    name: 'Ice',
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 12,
  },
});
const superIceSize = await prisma.customizationGroup.upsert({
  where: { id: 'seed-group-super-ice-size' },
  update: {
    name: 'Super Ice Size',
    isActive: true,
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 13,
  },
  create: {
    id: 'seed-group-super-ice-size',
    name: 'Super Ice Size',
    isRequired: true,
    selectionType: SelectionType.SINGLE,
    sortOrder: 13,
  },
});

const choiceOptions: [string, string, string, number][] = [
  ['seed-option-size-s', size.id, 'Small', 1],
  ['seed-option-size-m', size.id, 'Medium', 2],
  ['seed-option-size-l', size.id, 'Large', 3],
  ['seed-option-sugar-normal', sugar.id, 'Normal', 1],
  ['seed-option-sugar-less', sugar.id, 'Less', 2],
  ['seed-option-sugar-no', sugar.id, 'No', 3],
  ['seed-option-ice-normal', ice.id, 'Normal', 1],
  ['seed-option-ice-less', ice.id, 'Less', 2],
  ['seed-option-ice-no', ice.id, 'No', 3],
  ['seed-option-super-ice-s', superIceSize.id, 'Small', 1],
  ['seed-option-super-ice-m', superIceSize.id, 'Medium', 2],
  ['seed-option-super-ice-l', superIceSize.id, 'Large', 3],
];
for (const [id, groupId, name, sortOrder] of choiceOptions) {
  await prisma.customizationOption.upsert({
    where: { id },
    update: { name, additionalPrice: 0, sortOrder, isActive: true },
    create: { id, groupId, name, additionalPrice: 0, sortOrder },
  });
}

await prisma.product.update({
  where: { id: 'menu-cappuccino' },
  data: { isTopSale: true },
});
await prisma.product.update({
  where: { id: 'menu-caramel-frappe' },
  data: { isTopSale: true },
});
await prisma.product.update({
  where: { id: 'menu-latte' },
  data: { discountPercent: 9, compareAtPrice: 4.4 },
});

for (const product of products) {
  for (const [group, sortOrder] of [
    [size, 10],
    [sugar, 11],
    [ice, 12],
    [superIceSize, 13],
  ] as const) {
    await prisma.productCustomizationGroup.upsert({
      where: { productId_groupId: { productId: product.id, groupId: group.id } },
      update: { sortOrder },
      create: { productId: product.id, groupId: group.id, sortOrder },
    });
  }
}

const today = new Date();
today.setUTCHours(0, 0, 0, 0);
await prisma.cakeOfTheDay.updateMany({
  where: { id: { not: 'seed-cake-today' } },
  data: { isActive: false },
});
await prisma.cakeOfTheDay.upsert({
  where: { id: 'seed-cake-today' },
  update: {
    date: today,
    productId: latte.id,
    title: 'Latte',
    description: 'Today’s featured drink — smooth espresso with steamed milk',
    imageUrl: latte.imageUrl,
    isActive: true,
    isAvailable: true,
  },
  create: {
    id: 'seed-cake-today',
    date: today,
    productId: latte.id,
    title: 'Latte',
    description: 'Today’s featured drink — smooth espresso with steamed milk',
    imageUrl: latte.imageUrl,
    isAvailable: true,
    isActive: true,
  },
});

await prisma.appConfig.upsert({
  where: { id: 'default' },
  update: { onboardingCtaText: 'Get Started' },
  create: { id: 'default', homeBannerImageUrl: null, onboardingCtaText: 'Get Started' },
});

const onboardingSlides = [
  {
    id: 'seed-onboarding-cafe',
    sortOrder: 1,
    imageUrl: '/uploads/onboarding/cafe-snow.jpg',
    title: 'Welcome to Roots Café',
    body: 'Your neighbourhood café — come in from the cold for specialty coffee.',
    titlePlacement: 'bottom',
    titleAlign: 'center',
    bodyAlign: 'center',
    copyBlockVertical: 'bottom',
    showBottomShadow: true,
  },
  {
    id: 'seed-onboarding-1',
    sortOrder: 2,
    imageUrl: '/uploads/onboarding/slide-1.png',
    title: 'Enjoy quality brew with the finest of flavours',
    body: 'The best of its kind you can ever get with exquisite taste and quality flavors.',
    titlePlacement: 'top',
    titleAlign: 'center',
    bodyAlign: 'center',
    copyBlockVertical: 'bottom',
    showBottomShadow: false,
  },
  {
    id: 'seed-onboarding-2',
    sortOrder: 3,
    imageUrl: '/uploads/onboarding/slide-2.png',
    title: 'Experience the Joy of Coffee in Every Blissful Sip!',
    body: 'Indulge in rich aromas and smooth flavors crafted for true coffee lovers.',
    titlePlacement: 'bottom',
    titleAlign: 'center',
    bodyAlign: 'center',
    copyBlockVertical: 'bottom',
    showBottomShadow: true,
  },
];

for (const slide of onboardingSlides) {
  await prisma.onboardingSlide.upsert({
    where: { id: slide.id },
    update: {
      ...slide,
      isActive: true,
      imageUrl: slide.imageUrl ?? null,
    },
    create: {
      ...slide,
      isActive: true,
    },
  });
}

const sampleOrders: [OrderStatus, string, number][] = [
  [OrderStatus.COMPLETED, 'RC-SEED-0004', 9],
  [OrderStatus.READY_FOR_PICKUP, 'RC-SEED-0003', 11],
  [OrderStatus.PREPARING, 'RC-SEED-0002', 14],
  [OrderStatus.RECEIVED, 'RC-SEED-0001', 16],
];

for (const [status, orderNumber, hour] of sampleOrders) {
  const createdAt = new Date();
  createdAt.setHours(hour, 15, 0, 0);

  await prisma.order.upsert({
    where: { orderNumber },
    update: { status, createdAt },
    create: {
      orderNumber,
      customerId: customer.id,
      status,
      pickupType: PickupType.ASAP,
      paymentStatus:
        status === OrderStatus.COMPLETED
          ? PaymentStatus.PAID
          : PaymentStatus.UNPAID,
      subtotal: 4.3,
      tax: 0,
      total: 4.3,
      createdAt,
      items: {
        create: {
          productId: latte.id,
          productNameSnapshot: latte.name,
          unitPriceSnapshot: 4.3,
          quantity: 1,
          lineTotal: 4.3,
          customizations: {
            create: {
              optionId: oat.id,
              groupNameSnapshot: milk.name,
              optionNameSnapshot: oat.name,
              additionalPriceSnapshot: 0.5,
            },
          },
        },
      },
    },
  });
}

console.log(
  `Seed complete — ${products.length} menu products (${products.filter((p) => p.imageUrl).length} with photos)`,
);
await prisma.$disconnect();
