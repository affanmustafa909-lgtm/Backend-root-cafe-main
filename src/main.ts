import { mkdir } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { uploadDirectory } from './uploads/storage.js';

function isAllowedCorsOrigin(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return true;
  if (allowed.includes('*') || allowed.includes(origin)) return true;
  for (const rule of allowed) {
    if (!rule.includes('*')) continue;
    const pattern = rule
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    if (new RegExp(`^${pattern}$`).test(origin)) return true;
  }
  try {
    const { hostname } = new URL(origin);
    return hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  await mkdir(uploadDirectory(), { recursive: true });
  app.use(
    helmet({
      // Allow admin (5173) to display API-hosted /uploads images
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin, config.get<string[]>('corsOrigins') ?? []));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useStaticAssets(uploadDirectory(), { prefix: '/uploads/' });
  await app.listen(config.get<number>('port') ?? 3000);
}
await bootstrap();
