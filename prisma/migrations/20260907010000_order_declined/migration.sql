-- Allow café staff to decline orders (sold out / closed early / etc.)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
