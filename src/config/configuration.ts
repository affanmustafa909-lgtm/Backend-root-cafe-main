export interface PickupConfiguration {
  openTime: string;
  closeTime: string;
  slotIntervalMinutes: number;
  maxDaysAhead: number;
  asapEstimateMinutes: number | null;
}

export interface AppConfiguration {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  uploadDir: string;
  taxRate: number;
  timezone: string;
  currency: string;
  reportingEnabled: boolean;
  pickup: PickupConfiguration;
}

const bool = (value: string | undefined, fallback = false) =>
  value === undefined ? fallback : value.toLowerCase() === 'true';

const optionalInt = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default (): AppConfiguration => ({
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://localhost:8081'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  taxRate: Number(process.env.TAX_RATE ?? 0),
  timezone: process.env.TIMEZONE ?? 'Europe/Dublin',
  currency: process.env.CURRENCY ?? 'EUR',
  reportingEnabled: bool(process.env.ENABLE_REPORTING),
  pickup: {
    openTime: process.env.PICKUP_OPEN_TIME ?? '08:00',
    closeTime: process.env.PICKUP_CLOSE_TIME ?? '18:00',
    slotIntervalMinutes: Number(process.env.PICKUP_SLOT_INTERVAL_MINUTES ?? 15),
    maxDaysAhead: Number(process.env.PICKUP_MAX_DAYS_AHEAD ?? 7),
    asapEstimateMinutes: optionalInt(process.env.ASAP_ESTIMATE_MINUTES),
  },
});
