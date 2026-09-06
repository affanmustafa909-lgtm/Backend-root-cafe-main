import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';

const transitions: Partial<Record<OrderStatus, OrderStatus>> = {
  RECEIVED: OrderStatus.PREPARING,
  PREPARING: OrderStatus.READY_FOR_PICKUP,
  READY_FOR_PICKUP: OrderStatus.COMPLETED,
};

function canTransition(from: OrderStatus, to: OrderStatus) {
  if (to === OrderStatus.DECLINED) {
    return (
      from === OrderStatus.RECEIVED ||
      from === OrderStatus.PREPARING ||
      from === OrderStatus.READY_FOR_PICKUP
    );
  }
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

  it('allows decline from active statuses', () => {
    expect(canTransition(OrderStatus.RECEIVED, OrderStatus.DECLINED)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.DECLINED)).toBe(
      true,
    );
    expect(
      canTransition(OrderStatus.READY_FOR_PICKUP, OrderStatus.DECLINED),
    ).toBe(true);
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.DECLINED)).toBe(
      false,
    );
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
