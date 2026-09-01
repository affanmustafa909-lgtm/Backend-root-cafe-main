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
import { Prisma, SelectionType } from '@prisma/client';
import { AdminRoles, ManagerRoles, Public, Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Public()
@Controller('customizations')
class CustomizationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list() {
    return serialize(
      await this.prisma.customizationGroup.findMany({
        where: { isActive: true },
        include: {
          options: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  }
}

@Roles(...AdminRoles)
@Controller('admin/customizations')
class AdminCustomizationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list() {
    return serialize(
      await this.prisma.customizationGroup.findMany({ include: { options: true } }),
    );
  }
  @Roles(...ManagerRoles)
  @Post('groups')
  createGroup(
    @Body()
    dto: {
      name: string;
      isRequired?: boolean;
      selectionType?: SelectionType;
      maxSelections?: number;
      sortOrder?: number;
    },
  ) {
    return this.prisma.customizationGroup.create({ data: dto });
  }
  @Roles(...ManagerRoles)
  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.prisma.customizationGroup.update({ where: { id }, data: dto });
  }
  @Roles(...ManagerRoles)
  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.prisma.customizationGroup.update({
      where: { id },
      data: { isActive: false },
    });
  }
  @Roles(...ManagerRoles)
  @Post('groups/:groupId/options')
  async createOption(
    @Param('groupId') groupId: string,
    @Body()
    dto: {
      name: string;
      additionalPrice?: number;
      isAvailable?: boolean;
      sortOrder?: number;
    },
  ) {
    return serialize(
      await this.prisma.customizationOption.create({
        data: {
          ...dto,
          groupId,
          additionalPrice:
            dto.additionalPrice === undefined
              ? undefined
              : new Prisma.Decimal(dto.additionalPrice),
        },
      }),
    );
  }
  @Roles(...ManagerRoles)
  @Patch('options/:id')
  updateOption(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.prisma.customizationOption.update({
      where: { id },
      data: dto,
    });
  }
  @Roles(...ManagerRoles)
  @Delete('options/:id')
  deleteOption(@Param('id') id: string) {
    return this.prisma.customizationOption.update({
      where: { id },
      data: { isActive: false, isAvailable: false },
    });
  }
  @Roles(...ManagerRoles)
  @Put('products/:productId/groups')
  async associate(
    @Param('productId') productId: string,
    @Body() dto: { groupIds: string[] },
  ) {
    await this.prisma.$transaction([
      this.prisma.productCustomizationGroup.deleteMany({ where: { productId } }),
      ...dto.groupIds.map((groupId, sortOrder) =>
        this.prisma.productCustomizationGroup.create({
          data: { productId, groupId, sortOrder },
        }),
      ),
    ]);
    return { success: true };
  }
}

@Module({
  controllers: [CustomizationsController, AdminCustomizationsController],
})
export class CustomizationsModule {}
