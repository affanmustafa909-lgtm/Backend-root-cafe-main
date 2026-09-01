# Roots Café — API

NestJS REST + Socket.IO API with Prisma and PostgreSQL. See the [root README](../README.md) for architecture, seed credentials, and full-stack setup.

## Setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

API: `http://localhost:3000`

PostgreSQL is expected on port **5434** (see `docker compose up -d postgres`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile |
| `npm run start:prod` | Run `dist/main` |
| `npm test` | Unit tests |
| `npm run seed` | Seed demo users and menu |
| `npx prisma migrate dev` | Create/apply migrations |

## Docker

From the repo root:

```bash
docker compose up --build
```
