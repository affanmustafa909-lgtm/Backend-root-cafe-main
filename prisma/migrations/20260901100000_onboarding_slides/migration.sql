-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN "onboardingCtaText" TEXT DEFAULT 'Get Started';

-- CreateTable
CREATE TABLE "OnboardingSlide" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "titlePlacement" TEXT NOT NULL DEFAULT 'top',
    "titleAlign" TEXT NOT NULL DEFAULT 'center',
    "bodyAlign" TEXT NOT NULL DEFAULT 'center',
    "copyBlockVertical" TEXT NOT NULL DEFAULT 'bottom',
    "showBottomShadow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingSlide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingSlide_isActive_sortOrder_idx" ON "OnboardingSlide"("isActive", "sortOrder");
