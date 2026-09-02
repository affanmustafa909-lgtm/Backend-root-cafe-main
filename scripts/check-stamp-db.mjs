import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
try {
  const cfg = await p.appConfig.findUnique({ where: { id: 'default' } });
  console.log(
    'appConfig',
    JSON.stringify({
      enabled: cfg?.stampCardEnabled,
      required: cfg?.stampCardRequired,
      title: cfg?.stampCardTitle,
    }),
  );
  const cards = await p.customerStampCard.findMany({ take: 5 });
  console.log('stampCards', cards.length, JSON.stringify(cards));
  const sample = await p.order.findFirst({
    select: {
      id: true,
      stampApplied: true,
      redeemedStampReward: true,
      status: true,
      orderNumber: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log('latestOrder', JSON.stringify(sample));
} catch (e) {
  console.error('DB ERROR', e?.message || e);
  process.exitCode = 1;
} finally {
  await p.$disconnect();
}
