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
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminRoles, ManagerRoles, Public, Roles } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  RealtimeModule,
  RealtimeService,
} from '../realtime/realtime.module.js';
import { imageFileFilter, imageStorage } from '../uploads/storage.js';
import { PickupSettingsService } from './pickup-settings.service.js';

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

@Roles(...AdminRoles)
@Controller('admin/settings')
class SettingsController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly pickupSettings: PickupSettingsService,
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
      ? { homeBannerImageUrl: `/uploads/${file.filename}` }
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

@Public()
@Controller('settings')
class PublicSettingsController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pickupSettings: PickupSettingsService,
  ) {}

  @Get('app')
  async app() {
    const pickup = await this.pickupSettings.resolve();
    const appConfig = await this.prisma.appConfig.findUnique({
      where: { id: BANNER_ID },
    });
    return {
      currency: this.config.get<string>('currency'),
      taxRate: this.config.get<number>('taxRate'),
      timezone: this.config.get<string>('timezone'),
      homeBannerImageUrl: appConfig?.homeBannerImageUrl ?? null,
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
  imports: [RealtimeModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [PickupSettingsService],
  exports: [PickupSettingsService],
})
export class SettingsModule {}
