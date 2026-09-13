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
import { toStoredBannerImageUrl } from '../uploads/durable-image.js';
import { publicMediaUrl } from '../uploads/materialize.js';
import { PickupSettingsService } from './pickup-settings.service.js';
import {
  StampCardModule,
  StampCardService,
} from '../loyalty/stamp-card.service.js';
import {
  composeImpressum,
  GERMAN_PRIVACY,
  GERMAN_TERMS,
  resolveLegalTexts,
  type CafeContact,
} from './legal-templates.js';

const BANNER_ID = 'default';

const bannerUpload = FileInterceptor('image', {
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 8_000_000 },
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

class UpdateLegalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cafeName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cafeStreet?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cafePostalCity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cafePhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cafeEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cafeOwner?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cafeVatId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  cafeImpressumNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  privacy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  terms?: string | null;
}

function legalAdminView(row: {
  cafeName?: string | null;
  cafeStreet?: string | null;
  cafePostalCity?: string | null;
  cafePhone?: string | null;
  cafeEmail?: string | null;
  cafeOwner?: string | null;
  cafeVatId?: string | null;
  cafeImpressumNotes?: string | null;
  legalImpressum?: string | null;
  legalPrivacy?: string | null;
  legalTerms?: string | null;
  updatedAt?: Date | null;
}) {
  const resolved = resolveLegalTexts(row);
  return {
    contact: resolved.contact,
    impressum: resolved.impressum,
    privacy: resolved.privacy,
    terms: resolved.terms,
    templates: { privacy: GERMAN_PRIVACY, terms: GERMAN_TERMS },
    updatedAt: row.updatedAt ?? null,
  };
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

  @Get('legal')
  async legal() {
    const row = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: { id: BANNER_ID },
      update: {},
    });
    return legalAdminView(row);
  }

  @Roles(...ManagerRoles)
  @Patch('legal')
  async updateLegal(@Body() dto: UpdateLegalDto) {
    const text = (v?: string | null) => {
      if (v === undefined) return undefined;
      const trimmed = (v ?? '').trim();
      return trimmed || null;
    };
    const contactPatch: Partial<CafeContact> = {};
    if (dto.cafeName !== undefined) contactPatch.name = dto.cafeName?.trim() ?? '';
    if (dto.cafeStreet !== undefined)
      contactPatch.street = dto.cafeStreet?.trim() ?? '';
    if (dto.cafePostalCity !== undefined)
      contactPatch.postalCity = dto.cafePostalCity?.trim() ?? '';
    if (dto.cafePhone !== undefined)
      contactPatch.phone = dto.cafePhone?.trim() ?? '';
    if (dto.cafeEmail !== undefined)
      contactPatch.email = dto.cafeEmail?.trim() ?? '';
    if (dto.cafeOwner !== undefined)
      contactPatch.owner = dto.cafeOwner?.trim() ?? '';
    if (dto.cafeVatId !== undefined)
      contactPatch.vatId = dto.cafeVatId?.trim() ?? '';
    if (dto.cafeImpressumNotes !== undefined)
      contactPatch.notes = dto.cafeImpressumNotes?.trim() ?? '';

    const existing = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: { id: BANNER_ID },
      update: {},
    });
    const mergedContact = {
      ...resolveLegalTexts(existing).contact,
      ...contactPatch,
    };
    const hasContact = Object.values(mergedContact).some((v) => v.trim());
    const data = {
      cafeName: text(dto.cafeName),
      cafeStreet: text(dto.cafeStreet),
      cafePostalCity: text(dto.cafePostalCity),
      cafePhone: text(dto.cafePhone),
      cafeEmail: text(dto.cafeEmail),
      cafeOwner: text(dto.cafeOwner),
      cafeVatId: text(dto.cafeVatId),
      cafeImpressumNotes: text(dto.cafeImpressumNotes),
      legalPrivacy: text(dto.privacy),
      legalTerms: text(dto.terms),
      legalImpressum: hasContact
        ? composeImpressum(mergedContact)
        : existing.legalImpressum?.trim() || composeImpressum(mergedContact),
    };
    const row = await this.prisma.appConfig.update({
      where: { id: BANNER_ID },
      data,
    });
    this.realtime.emitMenu('menu.updated', { type: 'legal' });
    return legalAdminView(row);
  }

  @Get('home-banner')
  async homeBanner() {
    const row = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: { id: BANNER_ID },
      update: {},
    });
    const homeBannerImageUrl = await publicMediaUrl(
      row.homeBannerImageUrl,
      `banner:${row.id}`,
    );
    return {
      homeBannerImageUrl: homeBannerImageUrl ?? row.homeBannerImageUrl,
      recommendedSize: {
        width: 1200,
        height: 576,
        aspectRatio: '2.08:1',
        maxFileMb: 5,
        formats: ['JPG', 'PNG', 'WEBP'],
        note: 'Landscape ~2:1. Upload a sharp JPG; we keep up to 1600px wide at high quality.',
      },
      updatedAt: row.updatedAt,
    };
  }

  @Roles(...ManagerRoles)
  @Patch('home-banner')
  @UseInterceptors(bannerUpload)
  async updateHomeBanner(@UploadedFile() file?: Express.Multer.File) {
    const data = file
      ? { homeBannerImageUrl: await toStoredBannerImageUrl(file) }
      : {};
    const row = await this.prisma.appConfig.upsert({
      where: { id: BANNER_ID },
      create: { id: BANNER_ID, ...data },
      update: data,
    });
    const homeBannerImageUrl = await publicMediaUrl(
      row.homeBannerImageUrl,
      `banner:${row.id}`,
    );
    this.realtime.emitMenu('menu.updated', {
      type: 'home-banner',
      homeBannerImageUrl: homeBannerImageUrl ?? row.homeBannerImageUrl,
    });
    return {
      homeBannerImageUrl: homeBannerImageUrl ?? row.homeBannerImageUrl,
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
    const homeBannerImageUrl = await publicMediaUrl(
      appConfig?.homeBannerImageUrl,
      `banner:${appConfig?.id ?? BANNER_ID}`,
    );
    return {
      currency: this.config.get<string>('currency'),
      taxRate: this.config.get<number>('taxRate'),
      timezone: this.config.get<string>('timezone'),
      homeBannerImageUrl:
        homeBannerImageUrl ?? appConfig?.homeBannerImageUrl ?? null,
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
      legal: (() => {
        const resolved = resolveLegalTexts(appConfig ?? {});
        return {
          impressum: resolved.impressum,
          privacy: resolved.privacy,
          terms: resolved.terms,
        };
      })(),
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
