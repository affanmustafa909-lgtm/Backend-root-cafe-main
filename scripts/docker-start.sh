#!/bin/sh
# Production entrypoint: apply migrations, baseline existing DBs (P3005), then start API.
set -eu

MIGRATIONS="
20260829000000_init
20260830120000_product_sale_badges
20260830190000_app_config_banner
20260901100000_onboarding_slides
20260901120000_user_avatar_url
20260901130000_app_config_pickup
20260902180000_stamp_card
"

baseline_existing_db() {
  echo "Prisma P3005: database already has tables but no migration history. Baselining…"
  for name in $MIGRATIONS; do
    echo "  resolve --applied $name"
    npx prisma migrate resolve --applied "$name" || true
  done

  # Stamp-card SQL is idempotent (IF NOT EXISTS). Safe if schema was created via db push.
  if [ -f prisma/migrations/20260902180000_stamp_card/migration.sql ]; then
    echo "Ensuring stamp-card columns/tables exist…"
    npx prisma db execute \
      --file prisma/migrations/20260902180000_stamp_card/migration.sql \
      --schema prisma/schema.prisma || true
  fi
}

echo "Running prisma migrate deploy…"
if ! DEPLOY_OUT=$(npx prisma migrate deploy 2>&1); then
  echo "$DEPLOY_OUT"
  case "$DEPLOY_OUT" in
    *P3005*)
      baseline_existing_db
      echo "Re-running prisma migrate deploy after baseline…"
      npx prisma migrate deploy
      ;;
    *)
      echo "migrate deploy failed with a non-baseline error"
      exit 1
      ;;
  esac
else
  echo "$DEPLOY_OUT"
fi

echo "Restoring catalog product images from /uploads/menu…"
node --experimental-strip-types scripts/restore-menu-images.ts || true

echo "Starting API…"
exec node dist/main.js
