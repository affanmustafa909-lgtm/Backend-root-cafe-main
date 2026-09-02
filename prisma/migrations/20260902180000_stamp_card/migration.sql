-- Stamp card loyalty fields
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "stampCardEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "stampCardRequired" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "stampCardTitle" TEXT DEFAULT 'Stamp Card';
ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "stampCardSubtitle" TEXT DEFAULT 'Collect 8 drinks on the app — the 9th is free';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "redeemedStampReward" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "freeDrinkDiscount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stampApplied" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "CustomerStampCard" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "lifetimeStamps" INTEGER NOT NULL DEFAULT 0,
    "freeDrinksEarned" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerStampCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerStampCard_customerId_key" ON "CustomerStampCard"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerStampCard_stamps_idx" ON "CustomerStampCard"("stamps");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerStampCard_customerId_fkey'
  ) THEN
    ALTER TABLE "CustomerStampCard"
      ADD CONSTRAINT "CustomerStampCard_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
