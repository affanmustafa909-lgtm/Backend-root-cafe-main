import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PickupConfiguration } from '../config/configuration.js';
import { PrismaService } from '../prisma/prisma.service.js';

const BANNER_ID = 'default';

export type ResolvedPickup = PickupConfiguration;

@Injectable()
export class PickupSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private envPickup(): PickupConfiguration {
    return this.config.get<PickupConfiguration>('pickup')!;
  }

  async resolve(): Promise<ResolvedPickup> {
    const env = this.envPickup();
    const row = await this.prisma.appConfig.findUnique({
      where: { id: BANNER_ID },
    });
    return {
      openTime: row?.pickupOpenTime ?? env.openTime,
      closeTime: row?.pickupCloseTime ?? env.closeTime,
      slotIntervalMinutes:
        row?.pickupSlotIntervalMin ?? env.slotIntervalMinutes,
      maxDaysAhead: row?.pickupMaxDaysAhead ?? env.maxDaysAhead,
      asapEstimateMinutes:
        row?.asapEstimateMinutes ?? env.asapEstimateMinutes,
    };
  }

  async getAdminView() {
    const env = this.envPickup();
    const row = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: { id: BANNER_ID },
      update: {},
    });
    return {
      openTime: row.pickupOpenTime ?? env.openTime,
      closeTime: row.pickupCloseTime ?? env.closeTime,
      slotIntervalMinutes:
        row.pickupSlotIntervalMin ?? env.slotIntervalMinutes,
      maxDaysAhead: row.pickupMaxDaysAhead ?? env.maxDaysAhead,
      asapEstimateMinutes:
        row.asapEstimateMinutes ?? env.asapEstimateMinutes,
      source: {
        openTime: row.pickupOpenTime ? 'database' : 'env',
        closeTime: row.pickupCloseTime ? 'database' : 'env',
        slotIntervalMinutes: row.pickupSlotIntervalMin
          ? 'database'
          : 'env',
        maxDaysAhead: row.pickupMaxDaysAhead ? 'database' : 'env',
        asapEstimateMinutes:
          row.asapEstimateMinutes != null ? 'database' : 'env',
      },
      updatedAt: row.updatedAt,
    };
  }

  async update(input: {
    openTime?: string;
    closeTime?: string;
    slotIntervalMinutes?: number;
    maxDaysAhead?: number;
    asapEstimateMinutes?: number | null;
  }) {
    const row = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: {
        id: BANNER_ID,
        pickupOpenTime: input.openTime,
        pickupCloseTime: input.closeTime,
        pickupSlotIntervalMin: input.slotIntervalMinutes,
        pickupMaxDaysAhead: input.maxDaysAhead,
        asapEstimateMinutes: input.asapEstimateMinutes ?? undefined,
      },
      update: {
        ...(input.openTime !== undefined && {
          pickupOpenTime: input.openTime,
        }),
        ...(input.closeTime !== undefined && {
          pickupCloseTime: input.closeTime,
        }),
        ...(input.slotIntervalMinutes !== undefined && {
          pickupSlotIntervalMin: input.slotIntervalMinutes,
        }),
        ...(input.maxDaysAhead !== undefined && {
          pickupMaxDaysAhead: input.maxDaysAhead,
        }),
        ...(input.asapEstimateMinutes !== undefined && {
          asapEstimateMinutes: input.asapEstimateMinutes,
        }),
      },
    });
    return this.getAdminView();
  }
}
