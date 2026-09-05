import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { AdminRoles, ManagerRoles, Public, Roles } from '../common/auth.js';
import { serialize } from '../common/serialization.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  RealtimeModule,
  RealtimeService,
} from '../realtime/realtime.module.js';
import { imageFileFilter, imageStorage } from '../uploads/storage.js';
import { toStoredImageUrl } from '../uploads/durable-image.js';
import { publicMediaUrl } from '../uploads/materialize.js';
import {
  ensureProductCustomizationDefaults,
  linkDefaultCustomizationsToProduct,
} from './default-customizations.js';

const toBool = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  return value === true || value === 'true' || value === '1';
};
const toOptNumber = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function asBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1 || value === 'on')
    return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asOptNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

class ProductDto {
  @IsString() categoryId: string;
  @IsString() name: string;
  @Type(() => Number) @IsNumber() @Min(0) price: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() allergens?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @Transform(toBool) @IsBoolean() isAvailable?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isSoldOut?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() soldOut?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isActive?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() active?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isTopSale?: boolean;
  @IsOptional()
  @Transform(toOptNumber)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  @Max(90)
  discountPercent?: number | null;
  @IsOptional()
  @Transform(toOptNumber)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  compareAtPrice?: number | null;
}

/** FormData / PATCH body — all fields optional, same transforms as create. */
class UpdateProductDto {
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() allergens?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @Transform(toBool) @IsBoolean() isAvailable?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isSoldOut?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() soldOut?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isActive?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() active?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isTopSale?: boolean;
  @IsOptional()
  @Transform(toOptNumber)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  @Max(90)
  discountPercent?: number | null;
  @IsOptional()
  @Transform(toOptNumber)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @Min(0)
  compareAtPrice?: number | null;
}

const imageUpload = FileInterceptor('image', {
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5_000_000 },
});

function toProductData(
  dto: Partial<ProductDto> | UpdateProductDto,
  file?: Express.Multer.File,
): Prisma.ProductUncheckedCreateInput | Prisma.ProductUncheckedUpdateInput {
  const isSoldOut = asBool(dto.isSoldOut ?? dto.soldOut);
  const isActive = asBool(dto.isActive ?? dto.active);
  const isAvailable = asBool(dto.isAvailable);
  const isTopSale = asBool(dto.isTopSale);
  const price = asNumber(dto.price);
  const sortOrder = asNumber(dto.sortOrder);
  const discountPercent = asOptNumber(dto.discountPercent);
  const compareAtPrice = asOptNumber(dto.compareAtPrice);

  return {
    ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
    ...(dto.name ? { name: dto.name } : {}),
    ...(dto.description !== undefined ? { description: dto.description } : {}),
    ...(price !== undefined ? { price: new Prisma.Decimal(price) } : {}),
    ...(dto.allergens !== undefined ? { allergens: dto.allergens } : {}),
    ...(sortOrder !== undefined ? { sortOrder: Math.trunc(sortOrder) } : {}),
    ...(isAvailable !== undefined ? { isAvailable } : {}),
    ...(isSoldOut !== undefined ? { isSoldOut } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(isTopSale !== undefined ? { isTopSale } : {}),
    ...(discountPercent !== undefined
      ? {
          discountPercent:
            discountPercent && discountPercent > 0
              ? Math.trunc(discountPercent)
              : null,
        }
      : {}),
    ...(compareAtPrice !== undefined
      ? {
          compareAtPrice:
            compareAtPrice && compareAtPrice > 0
              ? new Prisma.Decimal(compareAtPrice)
              : null,
        }
      : {}),
    // imageUrl is applied asynchronously via toStoredImageUrl in controllers
  };
}
class AvailabilityDto {
  @IsOptional() @Transform(toBool) @IsBoolean() isAvailable?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isSoldOut?: boolean;
}
const include = {
  category: true,
  customizationGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      group: {
        include: {
          options: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      },
    },
  },
};

async function withPublicImage<T extends { id: string; imageUrl?: string | null }>(
  product: T,
): Promise<T> {
  const imageUrl = await publicMediaUrl(product.imageUrl, `product:${product.id}`);
  return { ...product, imageUrl: imageUrl ?? null };
}

async function withPublicImages<T extends { id: string; imageUrl?: string | null }>(
  products: T[],
): Promise<T[]> {
  return Promise.all(products.map((p) => withPublicImage(p)));
}

@Public()
@Controller('products')
class ProductsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@Query('categoryId') categoryId?: string) {
    await ensureProductCustomizationDefaults(this.prisma);
    const rows = serialize(
      await this.prisma.product.findMany({
        where: { isActive: true, ...(categoryId && { categoryId }) },
        include,
        orderBy: [{ createdAt: 'desc' }, { sortOrder: 'asc' }],
      }),
    ) as Array<{ id: string; imageUrl?: string | null }>;
    return withPublicImages(rows);
  }

  /** Public sales ranking for Home “most sold first”. */
  @Get('popular')
  async popular(@Query('limit') raw?: string) {
    const take = Math.min(Math.max(Number(raw ?? 100) || 100, 1), 200);
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take,
    });
    return rows.map((row) => ({
      productId: row.productId,
      quantitySold: row._sum.quantity ?? 0,
    }));
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    await ensureProductCustomizationDefaults(this.prisma);
    await linkDefaultCustomizationsToProduct(this.prisma, id);
    const row = serialize(
      await this.prisma.product.findFirstOrThrow({
        where: { id, isActive: true },
        include,
      }),
    ) as { id: string; imageUrl?: string | null };
    return withPublicImage(row);
  }
}

@Roles(...AdminRoles)
@Controller('admin/products')
class AdminProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private async broadcast(product: { id: string; imageUrl?: string | null }) {
    const payload = await withPublicImage(
      serialize(product) as { id: string; imageUrl?: string | null },
    );
    this.realtime.emitMenu('product.availability_changed', payload);
    this.realtime.emitMenu('menu.updated', { type: 'product', payload });
  }

  @Get()
  async list() {
    const rows = serialize(
      await this.prisma.product.findMany({
        include,
        orderBy: [{ createdAt: 'desc' }, { sortOrder: 'asc' }],
      }),
    ) as Array<{ id: string; imageUrl?: string | null }>;
    return withPublicImages(rows);
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = serialize(
      await this.prisma.product.findFirstOrThrow({ where: { id }, include }),
    ) as { id: string; imageUrl?: string | null };
    return withPublicImage(row);
  }

  @Roles(...ManagerRoles)
  @Post()
  @UseInterceptors(imageUpload)
  async create(
    @Body() dto: ProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = toProductData(
      dto,
      file,
    ) as Prisma.ProductUncheckedCreateInput;
    if (file) {
      data.imageUrl = await toStoredImageUrl(file);
    }
    // New products must appear on the customer menu unless explicitly inactive
    if (data.isActive === undefined) data.isActive = true;
    if (data.isAvailable === undefined) data.isAvailable = true;
    if (data.isSoldOut === undefined) data.isSoldOut = false;
    // Newest items float to the top of the home / menu list
    if (data.sortOrder === undefined) {
      const { _min } = await this.prisma.product.aggregate({
        _min: { sortOrder: true },
      });
      data.sortOrder = (_min.sortOrder ?? 1) - 1;
    }
    const product = await this.prisma.product.create({
      data,
      include,
    });
    await ensureProductCustomizationDefaults(this.prisma);
    await linkDefaultCustomizationsToProduct(this.prisma, product.id);
    const withGroups = await this.prisma.product.findFirstOrThrow({
      where: { id: product.id },
      include,
    });
    await this.broadcast();
    return withPublicImage(serialize() as { id: string; imageUrl?: string | null });
  }

  @Roles(...AdminRoles)
  @Patch(':id')
  @UseInterceptors(imageUpload)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = toProductData(dto, file) as Prisma.ProductUncheckedUpdateInput;
    if (file) {
      data.imageUrl = await toStoredImageUrl(file);
    }
    const product = await this.prisma.product.update({
      where: { id },
      data,
      include,
    });
    await this.broadcast();
    return withPublicImage(serialize() as { id: string; imageUrl?: string | null });
  }

  @Roles(...AdminRoles)
  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    const product = await this.prisma.product.update({
      where: { id },
      data: { isActive: false, isAvailable: false, isSoldOut: false },
      include,
    });
    await this.broadcast();
    return withPublicImage(serialize() as { id: string; imageUrl?: string | null });
  }

  @Roles(...AdminRoles)
  @Patch(':id/availability')
  async availability(@Param('id') id: string, @Body() dto: AvailabilityDto) {
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.isSoldOut !== undefined ? { isSoldOut: dto.isSoldOut } : {}),
        ...(dto.isAvailable !== undefined
          ? { isAvailable: dto.isAvailable }
          : {}),
        // Sold-out toggle should bring item back onto an active menu row
        ...(dto.isSoldOut === false ? { isActive: true, isAvailable: true } : {}),
      },
      include,
    });
    await this.broadcast();
    return withPublicImage(serialize() as { id: string; imageUrl?: string | null });
  }

  @Roles(...ManagerRoles)
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: imageStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 5_000_000 },
    }),
  )
  async image(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\// })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    const product = await this.prisma.product.update({
      where: { id },
      data: { imageUrl: await toStoredImageUrl(file) },
      include,
    });
    await this.broadcast();
    return withPublicImage(serialize() as { id: string; imageUrl?: string | null });
  }
}

@Module({
  imports: [RealtimeModule],
  controllers: [ProductsController, AdminProductsController],
})
export class ProductsModule {}
