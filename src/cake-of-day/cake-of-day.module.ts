import {
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { AdminRoles, ManagerRoles, Public, Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeModule, RealtimeService } from '../realtime/realtime.module.js';
import { toStoredImageUrl } from '../uploads/durable-image.js';
import { publicMediaUrl } from '../uploads/materialize.js';
import { imageFileFilter, imageStorage } from '../uploads/storage.js';

const day = (value?: string) => {
  const date = value ? new Date(`${value}T00:00:00.000Z`) : new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const cakeUpload = FileInterceptor('image', {
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 8_000_000 },
});

function asBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 'on') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

type CakeRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  date: Date | string;
  isAvailable?: boolean;
  isActive?: boolean;
  productId?: string | null;
  product?: {
    id: string;
    name: string;
    price: unknown;
    imageUrl?: string | null;
  } | null;
};

async function withPublicCakeImage<T extends CakeRow>(row: T | null) {
  if (!row) return null;
  const imageUrl =
    (await publicMediaUrl(row.imageUrl, `cake:${row.id}`)) ??
    row.imageUrl ??
    null;
  const productImage = row.product
    ? ((await publicMediaUrl(
        row.product.imageUrl,
        `product:${row.product.id}`,
      )) ?? row.product.imageUrl)
    : null;
  return {
    ...row,
    imageUrl,
    // Admin form field aliases
    name: row.title ?? row.product?.name ?? '',
    available: row.isAvailable !== false,
    price: row.product ? Number(row.product.price) : 0,
    date:
      typeof row.date === 'string'
        ? row.date.slice(0, 10)
        : row.date.toISOString().slice(0, 10),
    product: row.product
      ? { ...row.product, imageUrl: productImage ?? null }
      : null,
  };
}

@Public()
@Controller('cake-of-day')
class CakeController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async get(@Query('date') date?: string) {
    const row = serialize(
      await this.prisma.cakeOfTheDay.findFirst({
        where: { date: day(date), isActive: true },
        include: { product: true },
      }),
    ) as CakeRow | null;
    return withPublicCakeImage(row);
  }
}

@Roles(...AdminRoles)
@Controller('admin/cake-of-day')
class AdminCakeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private bumpMenu() {
    this.realtime.emitMenu('menu.updated', { type: 'cake-of-day' });
  }

  @Get()
  async today(@Query('date') date?: string) {
    const row = serialize(
      await this.prisma.cakeOfTheDay.findFirst({
        where: { date: day(date), isActive: true },
        include: { product: true },
      }),
    ) as CakeRow | null;
    return withPublicCakeImage(row);
  }

  @Get('history')
  async history() {
    const rows = serialize(
      await this.prisma.cakeOfTheDay.findMany({
        include: { product: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    ) as CakeRow[];
    return Promise.all(rows.map((row) => withPublicCakeImage(row)));
  }

  /**
   * Admin form uses PUT + multipart (name/price/date/available/image).
   * Always adds a new featured cake entry (previous same-day entry is deactivated).
   */
  @Roles(...ManagerRoles)
  @Put()
  @UseInterceptors(cakeUpload)
  async upsert(
    @UploadedFile() file?: Express.Multer.File,
    @Body()
    body: {
      name?: string;
      title?: string;
      description?: string;
      date?: string;
      price?: string | number;
      available?: string | boolean;
      isAvailable?: string | boolean;
      productId?: string;
    } = {},
  ) {
    const date = day(body.date);
    const title = (body.title ?? body.name ?? '').trim() || 'Cake of the Day';
    const description = body.description?.trim() || null;
    const isAvailable =
      asBool(body.available) ?? asBool(body.isAvailable) ?? true;
    const price = asNumber(body.price);
    const imageUrl = file ? await toStoredImageUrl(file) : null;

    // One active cake per date — archive previous featured entries for this day.
    await this.prisma.cakeOfTheDay.updateMany({
      where: { date, isActive: true },
      data: { isActive: false },
    });

    let category = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: { contains: 'Cake', mode: 'insensitive' } },
          { name: { contains: 'Dessert', mode: 'insensitive' } },
          { name: { contains: 'Pastry', mode: 'insensitive' } },
        ],
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
    if (!category) {
      category = await this.prisma.category.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }
    if (!category) {
      category = await this.prisma.category.create({
        data: {
          name: 'Cakes',
          description: 'Featured cakes',
          sortOrder: 99,
          isActive: true,
        },
      });
    }

    const product = await this.prisma.product.create({
      data: {
        name: title,
        description,
        price: new Prisma.Decimal(price && price > 0 ? price : 0),
        categoryId: category.id,
        imageUrl,
        isActive: true,
        isAvailable,
        isSoldOut: !isAvailable,
        sortOrder: 0,
      },
    });

    const row = await this.prisma.cakeOfTheDay.create({
      data: {
        title,
        description,
        isAvailable,
        isActive: true,
        productId: product.id,
        imageUrl,
        date,
      },
      include: { product: true },
    });

    this.bumpMenu();
    return withPublicCakeImage(serialize(row) as CakeRow);
  }

  @Roles(...ManagerRoles)
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    const row = await this.prisma.cakeOfTheDay.update({
      where: { id },
      data: { isActive: false },
      include: { product: true },
    });
    this.bumpMenu();
    return withPublicCakeImage(serialize(row) as CakeRow);
  }

  @Roles(...ManagerRoles)
  @Post()
  async create(
    @Body()
    dto: {
      date: string;
      productId?: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      isAvailable?: boolean;
    },
  ) {
    const date = day(dto.date);
    if (
      await this.prisma.cakeOfTheDay.findFirst({
        where: { date, isActive: true },
      })
    )
      throw new ConflictException('An active cake already exists for this date');
    const row = await this.prisma.cakeOfTheDay.create({
      data: { ...dto, date },
      include: { product: true },
    });
    this.bumpMenu();
    return withPublicCakeImage(serialize(row) as CakeRow);
  }

  @Roles(...ManagerRoles)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown> & { date?: string; isActive?: boolean },
  ) {
    const date = dto.date ? day(dto.date) : undefined;
    if (dto.isActive !== false && date) {
      const existing = await this.prisma.cakeOfTheDay.findFirst({
        where: { date, isActive: true, id: { not: id } },
      });
      if (existing)
        throw new ConflictException('An active cake already exists for this date');
    }
    const row = await this.prisma.cakeOfTheDay.update({
      where: { id },
      data: { ...dto, date },
      include: { product: true },
    });
    this.bumpMenu();
    return withPublicCakeImage(serialize(row) as CakeRow);
  }
}

@Module({
  imports: [RealtimeModule],
  controllers: [CakeController, AdminCakeController],
})
export class CakeOfDayModule {}
