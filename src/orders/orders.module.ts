import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentStatus,
  PickupType,
  Prisma,
  Role,
} from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AdminRoles,
  CurrentUser,
  Roles,
} from '../common/auth.js';
import type { JwtUser } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  RealtimeModule,
  RealtimeService,
} from '../realtime/realtime.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { PickupSettingsService } from '../settings/pickup-settings.service.js';
import {
  StampCardModule,
  StampCardService,
} from '../loyalty/stamp-card.service.js';

class OrderItemDto {
  @IsString() productId: string;
  @IsInt() @Min(1) quantity: number;
  @IsArray() @IsString({ each: true }) optionIds: string[] = [];
}
class CreateOrderDto {
  @IsEnum(PickupType) pickupType: PickupType;
  @IsOptional() @IsString() pickupDate?: string;
  @IsOptional() @IsString() pickupTime?: string;
  @IsOptional() @IsString() notes?: string;
  /** Redeem stamp-card free drink (9th drink free). */
  @IsOptional() @IsBoolean() redeemFreeDrink?: boolean;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

const orderInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  },
  items: { include: { customizations: true } },
};
const transitions: Partial<Record<OrderStatus, OrderStatus>> = {
  RECEIVED: OrderStatus.PREPARING,
  PREPARING: OrderStatus.READY_FOR_PICKUP,
  READY_FOR_PICKUP: OrderStatus.COMPLETED,
};

@Injectable()
class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly pickupSettings: PickupSettingsService,
    private readonly stampCards: StampCardService,
  ) {}

  private async validateScheduledPickup(
    pickupDate: string,
    pickupTime: string,
  ) {
    const pickup = await this.pickupSettings.resolve();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate))
      throw new BadRequestException('Invalid pickup date format');
    if (!/^\d{2}:\d{2}$/.test(pickupTime))
      throw new BadRequestException('Invalid pickup time format');

    const [openH, openM] = pickup.openTime.split(':').map(Number);
    const [closeH, closeM] = pickup.closeTime.split(':').map(Number);
    const [timeH, timeM] = pickupTime.split(':').map(Number);
    const minutes = timeH * 60 + timeM;
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (minutes < openMinutes || minutes > closeMinutes)
      throw new BadRequestException('Pickup time is outside café hours');
    if ((minutes - openMinutes) % pickup.slotIntervalMinutes !== 0)
      throw new BadRequestException('Pickup time is not an available slot');

    const timezone = this.config.get<string>('timezone') ?? 'Europe/Dublin';
    const todayParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const today = new Date(`${todayParts}T00:00:00.000Z`);
    const selected = new Date(`${pickupDate}T00:00:00.000Z`);
    if (Number.isNaN(selected.getTime()))
      throw new BadRequestException('Invalid pickup date');
    const diffDays = Math.round(
      (selected.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays < 0)
      throw new BadRequestException('Pickup date cannot be in the past');
    if (diffDays > pickup.maxDaysAhead)
      throw new BadRequestException('Pickup date is too far in the future');
  }

  async create(userId: string, dto: CreateOrderDto) {
    if (dto.pickupType === PickupType.SCHEDULED && (!dto.pickupDate || !dto.pickupTime))
      throw new BadRequestException('Scheduled pickup requires date and time');
    if (dto.pickupType === PickupType.SCHEDULED)
      await this.validateScheduledPickup(dto.pickupDate!, dto.pickupTime!);
    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        isAvailable: true,
        isSoldOut: false,
      },
      include: {
        customizationGroups: {
          include: {
            group: { include: { options: true } },
          },
        },
      },
    });
    if (products.length !== productIds.length)
      throw new BadRequestException('One or more products are unavailable');

    const lines = dto.items.map((item) => {
      const product = products.find(({ id }) => id === item.productId)!;
      const groups = product.customizationGroups.map(({ group }) => group);
      const chosen = groups.flatMap((group) =>
        group.options
          .filter(
            (option) =>
              item.optionIds.includes(option.id) &&
              option.isActive &&
              option.isAvailable,
          )
          .map((option) => ({ group, option })),
      );
      if (chosen.length !== new Set(item.optionIds).size)
        throw new BadRequestException(`Invalid customization for ${product.name}`);
      for (const group of groups) {
        const count = chosen.filter((value) => value.group.id === group.id).length;
        if (group.isRequired && count === 0)
          throw new BadRequestException(`${group.name} is required`);
        if (group.selectionType === 'SINGLE' && count > 1)
          throw new BadRequestException(`${group.name} allows one selection`);
        if (group.maxSelections && count > group.maxSelections)
          throw new BadRequestException(`${group.name} selection limit exceeded`);
      }
      const unit = chosen.reduce(
        (total, { option }) => total.plus(option.additionalPrice),
        new Prisma.Decimal(product.price),
      );
      return { item, product, chosen, unit, total: unit.mul(item.quantity) };
    });
    let subtotal = lines.reduce(
      (total, line) => total.plus(line.total),
      new Prisma.Decimal(0),
    );
    let freeDrinkDiscount = new Prisma.Decimal(0);
    let redeemedStampReward = false;
    if (dto.redeemFreeDrink) {
      await this.stampCards.assertCanRedeem(userId);
      freeDrinkDiscount = this.stampCards.pickFreeDrinkDiscount(lines);
      if (freeDrinkDiscount.lessThanOrEqualTo(0)) {
        throw new BadRequestException('No drink available to redeem as free');
      }
      subtotal = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        subtotal.minus(freeDrinkDiscount),
      );
      redeemedStampReward = true;
    }
    const taxRate = new Prisma.Decimal(this.config.get<number>('taxRate') ?? 0);
    const tax = subtotal.mul(taxRate);
    const total = subtotal.plus(tax);
    const dateParts = new Intl.DateTimeFormat('en', {
      timeZone: this.config.get<string>('timezone') ?? 'Europe/Dublin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .reduce<Record<string, string>>((result, part) => {
        result[part.type] = part.value;
        return result;
      }, {});
    const prefix = `RC-${dateParts.year}${dateParts.month}${dateParts.day}-`;

    const order = await this.prisma.$transaction(
      async (tx) => {
        const count = await tx.order.count({
          where: { orderNumber: { startsWith: prefix } },
        });
        return tx.order.create({
          data: {
            orderNumber: `${prefix}${String(count + 1).padStart(4, '0')}`,
            customerId: userId,
            pickupType: dto.pickupType,
            pickupDate: dto.pickupDate
              ? new Date(`${dto.pickupDate}T00:00:00.000Z`)
              : undefined,
            pickupTime: dto.pickupTime,
            notes: dto.notes,
            subtotal,
            tax,
            total,
            redeemedStampReward,
            freeDrinkDiscount,
            items: {
              create: lines.map(({ item, product, chosen, unit, total: lineTotal }) => ({
                productId: product.id,
                productNameSnapshot: product.name,
                unitPriceSnapshot: unit,
                quantity: item.quantity,
                lineTotal,
                customizations: {
                  create: chosen.map(({ group, option }) => ({
                    optionId: option.id,
                    groupNameSnapshot: group.name,
                    optionNameSnapshot: option.name,
                    additionalPriceSnapshot: option.additionalPrice,
                  })),
                },
              })),
            },
          },
          include: orderInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000, maxWait: 10000 },
    );
    const created = serialize(order);
    this.realtime.emitAdmin('order.created', created);
    this.realtime.emitAdmin('order.updated', created);
    void this.notifications.send(
      userId,
      'ORDER_RECEIVED',
      'Order received',
      `Your order ${order.orderNumber} was received.`,
      { orderId: order.id },
    );
    return serialize(order);
  }

  async updateStatus(id: string, status: OrderStatus) {
    const current = await this.prisma.order.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();

    // Idempotent: already at requested status (double-click / stale UI).
    if (current.status === status) {
      const existing = await this.prisma.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
      if (
        status === OrderStatus.COMPLETED &&
        !existing.stampApplied
      ) {
        try {
          await this.stampCards.applyOnOrderCompleted({
            id: existing.id,
            customerId: existing.customerId,
            redeemedStampReward: existing.redeemedStampReward,
            stampApplied: existing.stampApplied,
          });
          const stampView = await this.stampCards.getCustomerView(
            existing.customerId,
          );
          this.realtime.emitCustomer(
            existing.customerId,
            'loyalty.stamp_updated',
            stampView,
          );
        } catch (err) {
          console.error('Stamp card apply failed (idempotent path)', err);
        }
      }
      const refreshed = await this.prisma.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      });
      return serialize(refreshed);
    }

    if (transitions[current.status] !== status) {
      throw new BadRequestException(
        `Invalid status transition (${current.status} → ${status})`,
      );
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        status,
        statusChangedAt: new Date(),
        ...(status === OrderStatus.COMPLETED && {
          paymentStatus: PaymentStatus.PAID,
        }),
      },
      include: orderInclude,
    });

    if (status === OrderStatus.COMPLETED) {
      try {
        await this.stampCards.applyOnOrderCompleted({
          id: order.id,
          customerId: order.customerId,
          redeemedStampReward: order.redeemedStampReward,
          stampApplied: order.stampApplied,
        });
      } catch (err) {
        // Never fail order completion because loyalty failed.
        console.error('Stamp card apply failed', err);
      }
    }

    const fresh = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: orderInclude,
    });
    const serialized = serialize(fresh);
    this.realtime.emitAdmin('order.updated', serialized);
    this.realtime.emitAdmin('order.status_changed', serialized);
    this.realtime.emitCustomer(order.customerId, 'order.updated', serialized);
    this.realtime.emitCustomer(order.customerId, 'order.status_changed', serialized);
    if (status === OrderStatus.COMPLETED) {
      try {
        const stampView = await this.stampCards.getCustomerView(order.customerId);
        this.realtime.emitCustomer(order.customerId, 'loyalty.stamp_updated', stampView);
      } catch (err) {
        console.error('Stamp card emit failed', err);
      }
    }
    if (status === OrderStatus.READY_FOR_PICKUP)
      void this.notifications.send(
        order.customerId,
        'ORDER_READY',
        'Order ready',
        `Your order ${order.orderNumber} is ready for pickup.`,
        { orderId: order.id },
      );
    return serialized;
  }

  async updatePayment(id: string, paymentStatus: PaymentStatus) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
    if (
      order.status === OrderStatus.COMPLETED &&
      paymentStatus !== PaymentStatus.PAID
    )
      throw new BadRequestException('Completed orders must remain paid');
    const updated = await this.prisma.order.update({
      where: { id },
      data: { paymentStatus },
      include: orderInclude,
    });
    const serialized = serialize(updated);
    this.realtime.emitAdmin('order.payment_updated', serialized);
    this.realtime.emitAdmin('order.updated', serialized);
    this.realtime.emitCustomer(updated.customerId, 'order.payment_updated', serialized);
    return serialized;
  }
}

@Roles(Role.CUSTOMER)
@Controller('orders')
class CustomerOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}
  @Post() create(@CurrentUser() user: JwtUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }
  @Get('me')
  async mine(@CurrentUser() user: JwtUser) {
    return serialize(
      await this.prisma.order.findMany({
        where: { customerId: user.id },
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
  @Get('me/:id')
  async one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order || order.customerId !== user.id) throw new ForbiddenException();
    return serialize(order);
  }
}

@Roles(...AdminRoles)
@Controller('admin/orders')
class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}
  @Get()
  async list(@Query('status') status?: OrderStatus) {
    return serialize(
      await this.prisma.order.findMany({
        where: status ? { status } : undefined,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }
  @Get(':id')
  async one(@Param('id') id: string) {
    return serialize(
      await this.prisma.order.findUniqueOrThrow({
        where: { id },
        include: orderInclude,
      }),
    );
  }
  @Patch(':id/status')
  status(@Param('id') id: string, @Body() dto: { status: OrderStatus }) {
    return this.orders.updateStatus(id, dto.status);
  }
  @Patch(':id/payment')
  payment(
    @Param('id') id: string,
    @Body() dto: { paymentStatus: PaymentStatus },
  ) {
    return this.orders.updatePayment(id, dto.paymentStatus);
  }
}

@Module({
  imports: [RealtimeModule, NotificationsModule, SettingsModule, StampCardModule],
  controllers: [CustomerOrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
