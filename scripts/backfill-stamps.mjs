import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function applyOne(order) {
  if (order.stampApplied) return 'skip';

  const cfg = await p.appConfig.findUnique({ where: { id: 'default' } });
  const required = Math.max(1, cfg?.stampCardRequired || 8);
  const enabled = cfg?.stampCardEnabled !== false;

  const claimed = await p.order.updateMany({
    where: { id: order.id, stampApplied: false },
    data: { stampApplied: true },
  });
  if (claimed.count === 0) return 'already';

  if (!enabled) return 'disabled-marked';

  try {
    await p.customerStampCard.upsert({
      where: { customerId: order.customerId },
      create: { customerId: order.customerId },
      update: {},
    });

    const items = await p.orderItem.findMany({
      where: { orderId: order.id },
      select: { quantity: true },
    });
    const drinkCount = items.reduce(
      (sum, item) => sum + Math.max(0, item.quantity | 0),
      0,
    );
    const earned = order.redeemedStampReward
      ? Math.max(0, drinkCount - 1)
      : drinkCount;

    if (order.redeemedStampReward) {
      const card = await p.customerStampCard.findUniqueOrThrow({
        where: { customerId: order.customerId },
      });
      await p.customerStampCard.update({
        where: { customerId: order.customerId },
        data: {
          stamps: Math.max(0, card.stamps - required) + earned,
          lifetimeStamps: { increment: earned },
          freeDrinksEarned: { increment: 1 },
        },
      });
      return `redeemed+${earned}`;
    }

    if (earned > 0) {
      await p.customerStampCard.update({
        where: { customerId: order.customerId },
        data: {
          stamps: { increment: earned },
          lifetimeStamps: { increment: earned },
        },
      });
    }
    return `stamped+${earned}`;
  } catch (err) {
    await p.order.updateMany({
      where: { id: order.id, stampApplied: true },
      data: { stampApplied: false },
    });
    throw err;
  }
}

try {
  const broken = await p.order.findMany({
    where: { status: 'COMPLETED', stampApplied: false },
    orderBy: { createdAt: 'asc' },
  });
  console.log('unapplied completed:', broken.length);
  for (const order of broken) {
    const result = await applyOne(order);
    console.log(order.orderNumber, result, order.customerId);
  }
  const cards = await p.customerStampCard.findMany();
  console.log('cards after', JSON.stringify(cards, null, 2));
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  await p.$disconnect();
}
