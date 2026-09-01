import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal unit test for pickup validation logic extracted inline in OrdersService
class PickupValidator {
  constructor(private readonly config: ConfigService) {}

  validateScheduledPickup(pickupDate: string, pickupTime: string) {
    const pickup = this.config.get<{
      openTime: string;
      closeTime: string;
      slotIntervalMinutes: number;
      maxDaysAhead: number;
    }>('pickup');
    if (!pickup) throw new BadRequestException('Pickup configuration missing');

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
    const diffDays = Math.round(
      (selected.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays < 0)
      throw new BadRequestException('Pickup date cannot be in the past');
    if (diffDays > pickup.maxDaysAhead)
      throw new BadRequestException('Pickup date is too far in the future');
  }
}

describe('PickupValidator', () => {
  let config: ConfigService;
  let validator: PickupValidator;

  beforeEach(() => {
    config = {
      get: vi.fn((key: string) => {
        if (key === 'pickup')
          return {
            openTime: '08:00',
            closeTime: '18:00',
            slotIntervalMinutes: 15,
            maxDaysAhead: 7,
          };
        if (key === 'timezone') return 'Europe/Dublin';
        return undefined;
      }),
    } as unknown as ConfigService;
    validator = new PickupValidator(config);
  });

  it('accepts valid slot on today', () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Dublin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    expect(() => validator.validateScheduledPickup(today, '09:00')).not.toThrow();
  });

  it('rejects invalid slot interval', () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Dublin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    expect(() => validator.validateScheduledPickup(today, '09:07')).toThrow(
      /slot/i,
    );
  });

  it('rejects time outside hours', () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Dublin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    expect(() => validator.validateScheduledPickup(today, '19:00')).toThrow(
      /hours/i,
    );
  });
});
