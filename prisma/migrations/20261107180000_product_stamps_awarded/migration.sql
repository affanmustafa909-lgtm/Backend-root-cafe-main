-- Per-product stamp card earnings (default 1 = previous “one stamp per drink” behavior)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stampsAwarded" INTEGER NOT NULL DEFAULT 1;
