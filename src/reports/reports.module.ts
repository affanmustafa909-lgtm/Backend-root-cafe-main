import { Controller, ForbiddenException, Get, Module, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminRoles, Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Roles(...AdminRoles)
@Controller('admin/reports')
class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  private enabled() {
    if (!this.config.get<boolean>('reportingEnabled'))
      throw new ForbiddenException('Reporting is disabled');
  }
  @Get('daily')
  async daily(@Query('date') value?: string) {
    this.enabled();
    const start = value ? new Date(`${value}T00:00:00Z`) : new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return serialize(
      await this.prisma.order.aggregate({
        where: { createdAt: { gte: start, lt: end } },
        _count: true,
        _sum: { subtotal: true, tax: true, total: true },
      }),
    );
  }
  @Get('monthly')
  async monthly(@Query('month') value?: string) {
    this.enabled();
    const source = value ?? new Date().toISOString().slice(0, 7);
    const start = new Date(`${source}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return serialize(
      await this.prisma.order.aggregate({
        where: { createdAt: { gte: start, lt: end } },
        _count: true,
        _sum: { subtotal: true, tax: true, total: true },
      }),
    );
  }
  @Get('popular-products')
  async popular(@Query('limit') raw?: string) {
    this.enabled();
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId', 'productNameSnapshot'],
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: Math.min(Number(raw ?? 10), 100),
    });
    return serialize(rows);
  }
}

@Module({ controllers: [ReportsController] })
export class ReportsModule {}
