import {
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminRoles, ManagerRoles, Public, Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';

const day = (value?: string) => {
  const date = value ? new Date(`${value}T00:00:00.000Z`) : new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

@Public()
@Controller('cake-of-day')
class CakeController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async get(@Query('date') date?: string) {
    return serialize(
      await this.prisma.cakeOfTheDay.findFirst({
        where: { date: day(date), isActive: true },
        include: { product: true },
      }),
    );
  }
}

@Roles(...AdminRoles)
@Controller('admin/cake-of-day')
class AdminCakeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('date') date?: string) {
    return serialize(
      await this.prisma.cakeOfTheDay.findFirst({
        where: { date: day(date), isActive: true },
        include: { product: true },
      }),
    );
  }

  @Roles(...ManagerRoles)
  @Post()
  async create(
    @Body()
    dto: {
      date: string;
      productId?: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      isAvailable?: boolean;
    },
  ) {
    const date = day(dto.date);
    if (
      await this.prisma.cakeOfTheDay.findFirst({
        where: { date, isActive: true },
      })
    )
      throw new ConflictException('An active cake already exists for this date');
    return this.prisma.cakeOfTheDay.create({
      data: { ...dto, date },
    });
  }
  @Roles(...ManagerRoles)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown> & { date?: string; isActive?: boolean },
  ) {
    const date = dto.date ? day(dto.date) : undefined;
    if (dto.isActive !== false && date) {
      const existing = await this.prisma.cakeOfTheDay.findFirst({
        where: { date, isActive: true, id: { not: id } },
      });
      if (existing)
        throw new ConflictException('An active cake already exists for this date');
    }
    return this.prisma.cakeOfTheDay.update({
      where: { id },
      data: { ...dto, date },
    });
  }
}

@Module({ controllers: [CakeController, AdminCakeController] })
export class CakeOfDayModule {}
