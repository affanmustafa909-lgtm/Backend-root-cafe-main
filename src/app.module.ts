import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { JwtAuthGuard, RolesGuard } from './common/auth.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { CustomizationsModule } from './customizations/customizations.module.js';
import { CakeOfDayModule } from './cake-of-day/cake-of-day.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    CustomizationsModule,
    CakeOfDayModule,
    NotificationsModule,
    RealtimeModule,
    OrdersModule,
    DashboardModule,
    CustomersModule,
    ReportsModule,
    SettingsModule,
    OnboardingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
