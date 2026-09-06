import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AdminRoles, ManagerRoles, Public, Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeModule, RealtimeService } from '../realtime/realtime.module.js';
import { imageFileFilter, imageStorage } from '../uploads/storage.js';
import { toStoredImageUrl } from '../uploads/durable-image.js';
import { publicMediaUrl } from '../uploads/materialize.js';

const APP_ID = 'default';

const RECOMMENDED_SIZE = {
  width: 1080,
  height: 1920,
  aspectRatio: '9:16',
  maxFileMb: 5,
  formats: ['JPG', 'PNG', 'WEBP'],
  note: 'Full-screen portrait photo for the Get Started carousel. 1080×1920 px (9:16) fills most phones edge-to-edge.',
};

const slideUpload = FileInterceptor('image', {
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5_000_000 },
});

const toBool = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

class SlideDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional()
  @IsIn(['top', 'bottom'])
  titlePlacement?: string;
  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  titleAlign?: string;
  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  bodyAlign?: string;
  @IsOptional()
  @IsIn(['top', 'middle', 'bottom'])
  copyBlockVertical?: string;
  @IsOptional() @Transform(toBool) @IsBoolean() showBottomShadow?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @Transform(toBool) @IsBoolean() isActive?: boolean;
}

class CreateSlideDto extends SlideDto {
  @IsString() declare title: string;
  @IsString() declare body: string;
}

class CtaDto {
  @IsString() ctaText!: string;
}

@Public()
@Controller('onboarding')
class PublicOnboardingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const [slides, config] = await Promise.all([
      this.prisma.onboardingSlide.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.appConfig.findUnique({ where: { id: APP_ID } }),
    ]);
    const publicSlides = await Promise.all(
      slides.map(async (slide) => ({
        ...slide,
        imageUrl:
          (await publicMediaUrl(slide.imageUrl, `onboarding:${slide.id}`)) ??
          slide.imageUrl,
      })),
    );
    return serialize({
      slides: publicSlides,
      ctaText: config?.onboardingCtaText ?? 'Get Started',
      recommendedSize: RECOMMENDED_SIZE,
    });
  }
}

@Roles(...AdminRoles)
@Controller('admin/onboarding')
class AdminOnboardingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private bumpMenu() {
    this.realtime.emitMenu('menu.updated', { type: 'onboarding' });
  }

  @Get()
  async list() {
    const [slides, config] = await Promise.all([
      this.prisma.onboardingSlide.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.appConfig.findUnique({ where: { id: APP_ID } }),
    ]);
    const publicSlides = await Promise.all(
      slides.map(async (slide) => ({
        ...slide,
        imageUrl:
          (await publicMediaUrl(slide.imageUrl, `onboarding:${slide.id}`)) ??
          slide.imageUrl,
      })),
    );
    return serialize({
      slides: publicSlides,
      ctaText: config?.onboardingCtaText ?? 'Get Started',
      recommendedSize: RECOMMENDED_SIZE,
    });
  }

  @Get('meta')
  meta() {
    return { recommendedSize: RECOMMENDED_SIZE };
  }

  @Roles(...ManagerRoles)
  @Patch('cta')
  async updateCta(@Body() dto: CtaDto) {
    const row = await this.prisma.appConfig.upsert({
      where: { id: APP_ID },
      create: { id: APP_ID, onboardingCtaText: dto.ctaText },
      update: { onboardingCtaText: dto.ctaText },
    });
    this.bumpMenu();
    return { ctaText: row.onboardingCtaText };
  }

  @Roles(...ManagerRoles)
  @Post()
  @UseInterceptors(slideUpload)
  async create(
    @Body() dto: CreateSlideDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const maxOrder = await this.prisma.onboardingSlide.aggregate({
      _max: { sortOrder: true },
    });
    const row = serialize(
      await this.prisma.onboardingSlide.create({
        data: {
          title: dto.title,
          body: dto.body,
          titlePlacement: dto.titlePlacement ?? 'top',
          titleAlign: dto.titleAlign ?? 'center',
          bodyAlign: dto.bodyAlign ?? 'center',
          copyBlockVertical: dto.copyBlockVertical ?? 'bottom',
          showBottomShadow: dto.showBottomShadow ?? false,
          sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
          imageUrl: file ? await toStoredImageUrl(file) : null,
        },
      }),
    );
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Patch(':id')
  @UseInterceptors(slideUpload)
  async update(
    @Param('id') id: string,
    @Body() dto: SlideDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const row = serialize(
      await this.prisma.onboardingSlide.update({
        where: { id },
        data: {
          ...dto,
          ...(file ? { imageUrl: await toStoredImageUrl(file) } : {}),
        },
      }),
    );
    this.bumpMenu();
    return row;
  }

  @Roles(...ManagerRoles)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.onboardingSlide.delete({ where: { id } });
    this.bumpMenu();
    return { ok: true };
  }
}

@Module({
  imports: [RealtimeModule],
  controllers: [PublicOnboardingController, AdminOnboardingController],
})
export class OnboardingModule {}
