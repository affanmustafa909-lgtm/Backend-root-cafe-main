import { describe, it } from 'vitest';

describe('API e2e', () => {
  it('skipped without DATABASE_URL test database', () => {
    // Run against PostgreSQL in CI/local with:
    // docker compose up -d postgres
    // cd backend && npm run prisma:migrate && npm run seed
  });
});
