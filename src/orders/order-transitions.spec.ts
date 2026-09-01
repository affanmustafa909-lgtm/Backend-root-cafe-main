import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';

const transitions: Partial<Record<OrderStatus, OrderStatus>> = {
  RECEIVED: OrderStatus.PREPARING,
  PREPARING: OrderStatus.READY_FOR_PICKUP,
  READY_FOR_PICKUP: OrderStatus.COMPLETED,
};

function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from] === to;
}

describe('order status transitions', () => {
  it('allows the V1 forward flow only', () => {
    expect(canTransition(OrderStatus.RECEIVED, OrderStatus.PREPARING)).toBe(
      true,
    );
    expect(
      canTransition(OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP),
    ).toBe(true);
    expect(
      canTransition(OrderStatus.READY_FOR_PICKUP, OrderStatus.COMPLETED),
    ).toBe(true);
  });

  it('rejects invalid jumps', () => {
    expect(canTransition(OrderStatus.RECEIVED, OrderStatus.COMPLETED)).toBe(
      false,
    );
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.RECEIVED)).toBe(
      false,
    );
    expect(canTransition(OrderStatus.READY_FOR_PICKUP, OrderStatus.PREPARING)).toBe(
      false,
    );
  });
});

describe('reporting feature flag', () => {
  it('defaults to disabled', () => {
    const enabled =
      (process.env.ENABLE_REPORTING ?? 'false').toLowerCase() === 'true';
    expect(enabled).toBe(false);
  });
});
