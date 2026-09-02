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

    if (order.redeemedStampReward) {
      const card = await p.customerStampCard.findUniqueOrThrow({
        where: { customerId: order.customerId },
      });
      await p.customerStampCard.update({
        where: { customerId: order.customerId },
        data: {
          stamps: Math.max(0, card.stamps - required),
          freeDrinksEarned: { increment: 1 },
        },
      });
      return 'redeemed';
    }

    await p.customerStampCard.update({
      where: { customerId: order.customerId },
      data: {
        stamps: { increment: 1 },
        lifetimeStamps: { increment: 1 },
      },
    });
    return 'stamped';
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
