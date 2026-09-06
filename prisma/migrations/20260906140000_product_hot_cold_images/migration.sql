-- Hot / cold variation images for products (e.g. protein drinks)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrlHot" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrlCold" TEXT;
