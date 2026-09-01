import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Roles(Role.OWNER, Role.MANAGER)
@Controller('admin/customers')
class CustomersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@Query('search') search?: string) {
    return serialize(
      await this.prisma.user.findMany({
        where: {
          role: Role.CUSTOMER,
          ...(search && {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatarUrl: true,
          accountStatus: true,
          createdAt: true,
          _count: { select: { orders: true } },
          orders: {
            select: { total: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
  @Get(':id')
  async one(@Param('id') id: string) {
    return serialize(
      await this.prisma.user.findFirstOrThrow({
        where: { id, role: Role.CUSTOMER },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatarUrl: true,
          accountStatus: true,
          createdAt: true,
          orders: {
            include: { items: { include: { customizations: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
    );
  }
}

@Module({ controllers: [CustomersController] })
export class CustomersModule {}
