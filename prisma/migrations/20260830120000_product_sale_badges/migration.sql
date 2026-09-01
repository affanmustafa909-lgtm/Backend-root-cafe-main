-- AlterTable
ALTER TABLE "Product" ADD COLUMN "isTopSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "discountPercent" INTEGER;
ALTER TABLE "Product" ADD COLUMN "compareAtPrice" DECIMAL(10,2);
