import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AdminRoles, ManagerRoles, Public, Roles } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeModule, RealtimeService } from '../realtime/realtime.module.js';

class CategoryDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class ReorderDto {
  items: { id: string; sortOrder: number }[];
}

@Public()
@Controller('categories')
class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  list() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}

@Roles(...AdminRoles)
@Controller('admin/categories')
class AdminCategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private bumpMenu() {
    this.realtime.emitMenu('menu.updated', { type: 'categories' });
  }

  @Get()
  list() {
    // Soft-deleted categories stay hidden in admin
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Roles(...ManagerRoles)
  @Post()
  async create(@Body() dto: CategoryDto) {
    const row = await this.prisma.category.create({
      data: { ...dto, isActive: dto.isActive ?? true },
    });
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Put('reorder')
  async reorder(@Body() dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.category.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    this.bumpMenu();
    return { success: true };
  }

  @Roles(...ManagerRoles)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CategoryDto>) {
    const row = await this.prisma.category.update({
      where: { id },
      data: dto,
    });
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    const linked = await this.prisma.product.count({
      where: { categoryId: id, isActive: true },
    });
    let row;
    if (linked === 0) {
      await this.prisma.product.deleteMany({ where: { categoryId: id } });
      row = await this.prisma.category.delete({ where: { id } });
    } else {
      row = await this.prisma.category.update({
        where: { id },
        data: { isActive: false },
      });
    }
    this.bumpMenu();
    return row;
  }
}

@Module({
  imports: [RealtimeModule],
  controllers: [CategoriesController, AdminCategoriesController],
})
export class CategoriesModule {}
