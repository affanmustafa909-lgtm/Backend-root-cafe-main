import {
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { IsString, MinLength } from 'class-validator';
import { Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class AdminResetCustomerPasswordDto {
  @IsString()
  @MinLength(8)
  password: string;
}

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

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetCustomerPasswordDto,
  ) {
    const customer = await this.prisma.user.findFirst({
      where: { id, role: Role.CUSTOMER },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: customer.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: customer.id, usedAt: null },
      }),
    ]);

    return {
      message:
        'Temporary password set. Share it with the customer so they can sign in.',
    };
  }
}

@Module({ controllers: [CustomersController] })
export class CustomersModule {}
