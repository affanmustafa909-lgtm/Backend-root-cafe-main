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
  constructor(private readonly prisma: PrismaService) {}
  @Get() list() {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  }
  @Roles(...ManagerRoles)
  @Post() create(@Body() dto: CategoryDto) {
    return this.prisma.category.create({ data: dto });
  }
  @Roles(...ManagerRoles)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: Partial<CategoryDto>) {
    return this.prisma.category.update({ where: { id }, data: dto });
  }
  @Roles(...ManagerRoles)
  @Delete(':id') deactivate(@Param('id') id: string) {
    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }
  @Roles(...ManagerRoles)
  @Put('reorder') async reorder(@Body() dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.category.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    return { success: true };
  }
}

@Module({ controllers: [CategoriesController, AdminCategoriesController] })
export class CategoriesModule {}
