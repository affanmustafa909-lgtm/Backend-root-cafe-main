# Roots Cafe API — Docker build for Railway
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN mkdir -p uploads
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/uploads ./uploads
COPY scripts/docker-start.sh ./scripts/docker-start.sh
COPY scripts/restore-menu-images.ts ./scripts/restore-menu-images.ts
COPY prisma/menu-catalog.ts ./prisma/menu-catalog.ts
RUN chmod +x ./scripts/docker-start.sh
EXPOSE 3000
CMD ["./scripts/docker-start.sh"]
