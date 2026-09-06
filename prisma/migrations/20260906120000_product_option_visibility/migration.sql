-- AlterTable
ALTER TABLE "ProductCustomizationGroup" ADD COLUMN IF NOT EXISTS "enabledOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
