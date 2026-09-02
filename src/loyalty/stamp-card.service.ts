import {
  BadRequestException,
  Injectable,
  Module,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const APP_ID = 'default';

export type StampCardPublic = {
  enabled: boolean;
  stampsRequired: number;
  title: string;
  subtitle: string;
  stamps: number;
  stampsTowardReward: number;
  freeDrinkAvailable: boolean;
  freeDrinksEarned: number;
};

@Injectable()
export class StampCardService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    const row = await this.prisma.appConfig.upsert({
      where: { id: APP_ID },
      create: { id: APP_ID },
      update: {},
    });
    return {
      enabled: row.stampCardEnabled,
      stampsRequired: Math.max(1, row.stampCardRequired || 8),
      title: row.stampCardTitle?.trim() || 'Stamp Card',
      subtitle:
        row.stampCardSubtitle?.trim() ||
        'Collect 8 drinks on the app — the 9th is free',
    };
  }

  async updateConfig(input: {
    enabled?: boolean;
    stampsRequired?: number;
    title?: string | null;
    subtitle?: string | null;
  }) {
    const data: Prisma.AppConfigUpdateInput = {};
    if (typeof input.enabled === 'boolean') data.stampCardEnabled = input.enabled;
    if (typeof input.stampsRequired === 'number') {
      if (input.stampsRequired < 1 || input.stampsRequired > 50) {
        throw new BadRequestException('Stamps required must be between 1 and 50');
      }
      data.stampCardRequired = input.stampsRequired;
    }
    if (input.title !== undefined) data.stampCardTitle = input.title?.trim() || null;
    if (input.subtitle !== undefined) {
      data.stampCardSubtitle = input.subtitle?.trim() || null;
    }
    const row = await this.prisma.appConfig.upsert({
      where: { id: APP_ID },
      create: {
        id: APP_ID,
        stampCardEnabled: input.enabled ?? true,
        stampCardRequired: input.stampsRequired ?? 8,
        stampCardTitle: input.title?.trim() || 'Stamp Card',
        stampCardSubtitle:
          input.subtitle?.trim() ||
          'Collect 8 drinks on the app — the 9th is free',
      },
      update: data,
    });
    return {
      enabled: row.stampCardEnabled,
      stampsRequired: row.stampCardRequired,
      title: row.stampCardTitle,
      subtitle: row.stampCardSubtitle,
      updatedAt: row.updatedAt,
    };
  }

  private async getOrCreateCard(customerId: string) {
    return this.prisma.customerStampCard.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
    });
  }

  async getCustomerView(customerId: string): Promise<StampCardPublic> {
    const [config, card, pendingRedeem] = await Promise.all([
      this.getConfig(),
      this.getOrCreateCard(customerId),
      this.prisma.order.count({
        where: {
          customerId,
          redeemedStampReward: true,
          stampApplied: false,
          status: { not: 'COMPLETED' },
        },
      }),
    ]);
    const stampsTowardReward = Math.min(card.stamps, config.stampsRequired);
    const freeDrinkAvailable =
      config.enabled &&
      card.stamps >= config.stampsRequired &&
      pendingRedeem === 0;

    return {
      enabled: config.enabled,
      stampsRequired: config.stampsRequired,
      title: config.title,
      subtitle: config.subtitle,
      stamps: card.stamps,
      stampsTowardReward,
      freeDrinkAvailable,
      freeDrinksEarned: card.freeDrinksEarned,
    };
  }

  /** Highest single-unit price among lines — that amount becomes free. */
  pickFreeDrinkDiscount(
    lines: { unit: Prisma.Decimal; total: Prisma.Decimal }[],
  ): Prisma.Decimal {
    if (!lines.length) return new Prisma.Decimal(0);
    return lines.reduce(
      (best, line) => (line.unit.greaterThan(best) ? line.unit : best),
      lines[0].unit,
    );
  }

  async assertCanRedeem(customerId: string) {
    const view = await this.getCustomerView(customerId);
    if (!view.enabled) {
      throw new BadRequestException('Stamp card rewards are disabled');
    }
    if (!view.freeDrinkAvailable) {
      throw new BadRequestException(
        'No free drink available yet — keep collecting stamps',
      );
    }
    return view;
  }

  /**
   * Called when order becomes COMPLETED.
   * Avoids short interactive transactions (Railway latency often exceeds 5s).
   */
  async applyOnOrderCompleted(order: {
    id: string;
    customerId: string;
    redeemedStampReward: boolean;
    stampApplied: boolean;
  }) {
    if (order.stampApplied) return;

    const config = await this.getConfig();

    // Atomically claim this order so retries / double-completes can't double-stamp.
    const claimed = await this.prisma.order.updateMany({
      where: { id: order.id, stampApplied: false },
      data: { stampApplied: true },
    });
    if (claimed.count === 0) return;

    if (!config.enabled) return;

    try {
      await this.getOrCreateCard(order.customerId);

      if (order.redeemedStampReward) {
        const card = await this.prisma.customerStampCard.findUniqueOrThrow({
          where: { customerId: order.customerId },
        });
        await this.prisma.customerStampCard.update({
          where: { customerId: order.customerId },
          data: {
            stamps: Math.max(0, card.stamps - config.stampsRequired),
            freeDrinksEarned: { increment: 1 },
          },
        });
      } else {
        await this.prisma.customerStampCard.update({
          where: { customerId: order.customerId },
          data: {
            stamps: { increment: 1 },
            lifetimeStamps: { increment: 1 },
          },
        });
      }
    } catch (err) {
      // Allow a later retry (idempotent COMPLETED path) to re-apply.
      await this.prisma.order.updateMany({
        where: { id: order.id, stampApplied: true },
        data: { stampApplied: false },
      });
      throw err;
    }
  }
}

@Module({
  providers: [StampCardService],
  exports: [StampCardService],
})
export class StampCardModule {}
