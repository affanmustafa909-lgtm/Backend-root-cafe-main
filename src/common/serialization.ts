import { Prisma } from '@prisma/client';

export function serialize<T>(value: T): T {
  if (value instanceof Prisma.Decimal) return Number(value) as T;
  if (value instanceof Date) return value.toISOString() as T;
  if (Array.isArray(value)) return value.map(serialize) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serialize(child)]),
    ) as T;
  }
  return value;
}
