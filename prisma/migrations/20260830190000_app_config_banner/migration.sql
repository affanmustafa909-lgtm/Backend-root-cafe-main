-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "homeBannerImageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppConfig" ("id", "homeBannerImageUrl", "updatedAt")
VALUES ('default', NULL, CURRENT_TIMESTAMP);
