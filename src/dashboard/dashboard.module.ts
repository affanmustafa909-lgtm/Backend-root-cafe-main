import { Controller, Get, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { AdminRoles, Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';

const orderInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  items: { include: { customizations: true } },
};

@Roles(...AdminRoles)
@Controller('admin/dashboard')
class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('summary')
  async summary() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const statuses = [
      OrderStatus.RECEIVED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.COMPLETED,
    ] as const;

    const [statusCounts, recentOrders, revenueAgg] = await Promise.all([
      Promise.all(
        statuses.map(async (status) => ({
          status,
          count: await this.prisma.order.count({
            where: { createdAt: { gte: start }, status },
          }),
        })),
      ),
      this.prisma.order.findMany({
        where: { createdAt: { gte: start } },
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.config.get<boolean>('reportingEnabled')
        ? this.prisma.order.aggregate({
            where: { createdAt: { gte: start } },
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
    });
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
