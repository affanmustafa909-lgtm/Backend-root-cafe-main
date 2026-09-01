-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN "pickupOpenTime" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "pickupCloseTime" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "pickupSlotIntervalMin" INTEGER;
ALTER TABLE "AppConfig" ADD COLUMN "pickupMaxDaysAhead" INTEGER;
ALTER TABLE "AppConfig" ADD COLUMN "asapEstimateMinutes" INTEGER;
