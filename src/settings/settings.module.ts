import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Patch,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import {
  AdminRoles,
  CurrentUser,
  ManagerRoles,
  Public,
  Roles,
} from '../common/auth.js';
import type { JwtUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  RealtimeModule,
  RealtimeService,
} from '../realtime/realtime.module.js';
import { imageFileFilter, imageStorage } from '../uploads/storage.js';
import { toStoredImageUrl } from '../uploads/durable-image.js';
import { PickupSettingsService } from './pickup-settings.service.js';
import {
  StampCardModule,
  StampCardService,
} from '../loyalty/stamp-card.service.js';

const BANNER_ID = 'default';

const bannerUpload = FileInterceptor('image', {
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5_000_000 },
});

class UpdatePickupDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  openTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  closeTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  slotIntervalMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  maxDaysAhead?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  asapEstimateMinutes?: number | null;
}

class UpdateStampCardDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  stampsRequired?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string | null;
}

@Roles(...AdminRoles)
@Controller('admin/settings')
class SettingsController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly pickupSettings: PickupSettingsService,
    private readonly stampCards: StampCardService,
  ) {}

  @Get('features')
  features() {
    return {
      reporting: this.config.get<boolean>('reportingEnabled'),
      currency: this.config.get<string>('currency'),
      timezone: this.config.get<string>('timezone'),
    };
  }

  @Get('pickup')
  pickup() {
    return this.pickupSettings.getAdminView();
  }

  @Roles(...ManagerRoles)
  @Patch('pickup')
  async updatePickup(@Body() dto: UpdatePickupDto) {
    if (
      dto.openTime &&
      dto.closeTime &&
      dto.openTime >= dto.closeTime
    ) {
      throw new BadRequestException('Open time must be before close time');
    }
    const result = await this.pickupSettings.update(dto);
    this.realtime.emitMenu('menu.updated', { type: 'pickup-settings' });
    return result;
  }

  @Get('stamp-card')
  async stampCard() {
    const cfg = await this.stampCards.getConfig();
    const row = await this.prisma.appConfig.findUnique({
      where: { id: BANNER_ID },
    });
    return { ...cfg, updatedAt: row?.updatedAt ?? null };
  }

  @Roles(...ManagerRoles)
  @Patch('stamp-card')
  async updateStampCard(@Body() dto: UpdateStampCardDto) {
    const result = await this.stampCards.updateConfig(dto);
    this.realtime.emitMenu('menu.updated', { type: 'stamp-card' });
    return result;
  }

  @Get('home-banner')
  async homeBanner() {
    const row = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: { id: BANNER_ID },
      update: {},
    });
    return {
      homeBannerImageUrl: row.homeBannerImageUrl,
      recommendedSize: {
        width: 1200,
        height: 576,
        aspectRatio: '2.08:1',
        maxFileMb: 5,
        formats: ['JPG', 'PNG', 'WEBP'],
        note: 'Landscape image. App banner height is 168px; ~2:1 width fills edge-to-edge without heavy crop.',
      },
      updatedAt: row.updatedAt,
    };
  }

  @Roles(...ManagerRoles)
  @Patch('home-banner')
  @UseInterceptors(bannerUpload)
  async updateHomeBanner(@UploadedFile() file?: Express.Multer.File) {
    const data = file
      ? { homeBannerImageUrl: await toStoredImageUrl(file) }
      : {};
    const row = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: { id: BANNER_ID, ...data },
      update: data,
    });
    this.realtime.emitMenu('menu.updated', {
      type: 'home-banner',
      homeBannerImageUrl: row.homeBannerImageUrl,
    });
    return {
      homeBannerImageUrl: row.homeBannerImageUrl,
      updatedAt: row.updatedAt,
    };
  }

  @Roles(...ManagerRoles)
  @Patch('home-banner/clear')
  async clearHomeBanner() {
    const row = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: { id: BANNER_ID, homeBannerImageUrl: null },
      update: { homeBannerImageUrl: null },
    });
    this.realtime.emitMenu('menu.updated', {
      type: 'home-banner',
      homeBannerImageUrl: null,
    });
    return {
      homeBannerImageUrl: row.homeBannerImageUrl,
      updatedAt: row.updatedAt,
    };
  }
}

@Roles(Role.CUSTOMER)
@Controller('loyalty')
class CustomerLoyaltyController {
  constructor(private readonly stampCards: StampCardService) {}

  @Get('stamp-card')
  mine(@CurrentUser() user: JwtUser) {
    return this.stampCards.getCustomerView(user.id);
  }
}

@Public()
@Controller('settings')
class PublicSettingsController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pickupSettings: PickupSettingsService,
    private readonly stampCards: StampCardService,
  ) {}

  @Get('app')
  async app() {
    const pickup = await this.pickupSettings.resolve();
    const stamp = await this.stampCards.getConfig();
    const appConfig = await this.prisma.appConfig.findUnique({
      where: { id: BANNER_ID },
    });
    return {
      currency: this.config.get<string>('currency'),
      taxRate: this.config.get<number>('taxRate'),
      timezone: this.config.get<string>('timezone'),
      homeBannerImageUrl: appConfig?.homeBannerImageUrl ?? null,
      stampCard: {
        enabled: stamp.enabled,
        stampsRequired: stamp.stampsRequired,
        title: stamp.title,
        subtitle: stamp.subtitle,
      },
      pickup: {
        openTime: pickup.openTime,
        closeTime: pickup.closeTime,
        slotIntervalMinutes: pickup.slotIntervalMinutes,
        maxDaysAhead: pickup.maxDaysAhead,
        asapEstimateMinutes: pickup.asapEstimateMinutes,
      },
    };
  }
}

@Module({
  imports: [RealtimeModule, StampCardModule],
  controllers: [
    SettingsController,
    PublicSettingsController,
    CustomerLoyaltyController,
  ],
  providers: [PickupSettingsService],
  exports: [PickupSettingsService, StampCardModule],
})
export class SettingsModule {}
