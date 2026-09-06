import { Controller, Get, Module, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { AdminRoles, Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';

const orderInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  items: { include: { customizations: true } },
};

function dayRange(value?: string): { start: Date; end: Date } {
  let start: Date;
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    start = new Date(y, m - 1, d);
  } else {
    start = new Date();
    start.setHours(0, 0, 0, 0);
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function monthRange(value?: string): { start: Date; end: Date } {
  let start: Date;
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-').map(Number);
    start = new Date(y, m - 1, 1);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

@Roles(...AdminRoles)
@Controller('admin/dashboard')
class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('summary')
  async summary(
    @Query('date') date?: string,
    @Query('month') month?: string,
  ) {
    const period = month ? 'month' : 'day';
    const { start, end } = month ? monthRange(month) : dayRange(date);
    const statuses = [
      OrderStatus.RECEIVED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.COMPLETED,
    ] as const;
    const createdAt = { gte: start, lt: end };

    const [statusCounts, recentOrders, revenueAgg] = await Promise.all([
      Promise.all(
        statuses.map(async (status) => ({
          status,
          count: await this.prisma.order.count({
            where: { createdAt, status },
          }),
        })),
      ),
      this.prisma.order.findMany({
        where: { createdAt },
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        take: period === 'month' ? 25 : 10,
      }),
      this.config.get<boolean>('reportingEnabled')
        ? this.prisma.order.aggregate({
            where: { createdAt },
            _sum: { total: true },
          })
        : Promise.resolve(null),
    ]);

    const counts = Object.fromEntries(
      statusCounts.map(({ status, count }) => [status, count]),
    ) as Record<OrderStatus, number>;

    return serialize({
      counts,
      recentOrders,
      todayRevenue: revenueAgg?._sum.total ?? null,
      period,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    });
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
