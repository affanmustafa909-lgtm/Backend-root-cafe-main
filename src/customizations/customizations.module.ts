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
import { RealtimeModule, RealtimeService } from '../realtime/realtime.module.js';

type OptionInput = { name: string; price?: number; additionalPrice?: number };

function optionCreates(options: OptionInput[] | undefined) {
  return (options ?? []).map((option, sortOrder) => ({
    name: option.name.trim(),
    additionalPrice: new Prisma.Decimal(
      Number(option.price ?? option.additionalPrice ?? 0) || 0,
    ),
    sortOrder,
    isActive: true,
    isAvailable: true,
  }));
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private bumpMenu() {
    this.realtime.emitMenu('menu.updated', { type: 'customizations' });
  }

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

  /** Create group + options in one request (admin UI). */
  @Roles(...ManagerRoles)
  @Post()
  async createBundle(
    @Body()
    dto: {
      name: string;
      required?: boolean;
      isRequired?: boolean;
      options?: OptionInput[];
    },
  ) {
    const row = serialize(
      await this.prisma.customizationGroup.create({
        data: {
          name: dto.name,
          isRequired: Boolean(dto.required ?? dto.isRequired),
          options: { create: optionCreates(dto.options) },
        },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      }),
    );
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Post('groups')
  async createGroup(
    @Body()
    dto: {
      name: string;
      isRequired?: boolean;
      selectionType?: SelectionType;
      maxSelections?: number;
      sortOrder?: number;
    },
  ) {
    const row = await this.prisma.customizationGroup.create({ data: dto });
    this.bumpMenu();
    return row;
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
    this.bumpMenu();
    return { success: true };
  }

  @Roles(...ManagerRoles)
  @Patch('groups/:id')
  async updateGroup(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    const row = await this.prisma.customizationGroup.update({
      where: { id },
      data: dto,
    });
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Delete('groups/:id')
  async deleteGroup(@Param('id') id: string) {
    const row = await this.prisma.customizationGroup.update({
      where: { id },
      data: { isActive: false },
    });
    this.bumpMenu();
    return row;
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
    const row = serialize(
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
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Patch('options/:id')
  async updateOption(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    const data: Prisma.CustomizationOptionUpdateInput = { ...dto };
    if (dto.additionalPrice !== undefined || dto.price !== undefined) {
      data.additionalPrice = new Prisma.Decimal(
        Number(dto.additionalPrice ?? dto.price ?? 0) || 0,
      );
      delete (data as { price?: unknown }).price;
    }
    const row = serialize(
      await this.prisma.customizationOption.update({
        where: { id },
        data,
      }),
    );
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Delete('options/:id')
  async deleteOption(@Param('id') id: string) {
    const row = await this.prisma.customizationOption.update({
      where: { id },
      data: { isActive: false, isAvailable: false },
    });
    this.bumpMenu();
    return row;
  }

  /** Update group + replace options (admin UI). Must stay after static paths. */
  @Roles(...ManagerRoles)
  @Patch(':id')
  async updateBundle(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      required?: boolean;
      isRequired?: boolean;
      options?: OptionInput[];
    },
  ) {
    if (id === 'groups' || id === 'options' || id === 'products') {
      return { ok: false };
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customizationGroup.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.required !== undefined || dto.isRequired !== undefined
            ? { isRequired: Boolean(dto.required ?? dto.isRequired) }
            : {}),
        },
      });
      if (dto.options) {
        const existing = await tx.customizationOption.findMany({
          where: { groupId: id },
        });
        const keepIds = new Set<string>();
        for (const [sortOrder, option] of dto.options.entries()) {
          const name = option.name.trim();
          if (!name) continue;
          const price = new Prisma.Decimal(
            Number(option.price ?? option.additionalPrice ?? 0) || 0,
          );
          const match = existing.find(
            (row) =>
              row.name.toLowerCase() === name.toLowerCase() &&
              !keepIds.has(row.id),
          );
          if (match) {
            await tx.customizationOption.update({
              where: { id: match.id },
              data: {
                name,
                additionalPrice: price,
                sortOrder,
                isActive: true,
                isAvailable: true,
              },
            });
            keepIds.add(match.id);
          } else {
            const created = await tx.customizationOption.create({
              data: {
                groupId: id,
                name,
                additionalPrice: price,
                sortOrder,
                isActive: true,
                isAvailable: true,
              },
            });
            keepIds.add(created.id);
          }
        }
        await tx.customizationOption.updateMany({
          where: {
            groupId: id,
            ...(keepIds.size
              ? { id: { notIn: [...keepIds] } }
              : {}),
          },
          data: { isActive: false, isAvailable: false },
        });
      }
    });
    const row = serialize(
      await this.prisma.customizationGroup.findFirstOrThrow({
        where: { id },
        include: {
          options: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),
    );
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Delete(':id')
  async deleteBundle(@Param('id') id: string) {
    if (id === 'groups' || id === 'options' || id === 'products') {
      return { ok: false };
    }
    const row = await this.prisma.customizationGroup.update({
      where: { id },
      data: { isActive: false },
    });
    this.bumpMenu();
    return row;
  }
}

@Module({
  imports: [RealtimeModule],
  controllers: [CustomizationsController, AdminCustomizationsController],
})
export class CustomizationsModule {}
