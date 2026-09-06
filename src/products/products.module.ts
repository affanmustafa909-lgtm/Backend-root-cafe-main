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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
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

type ProductImageFiles = {
  image?: Express.Multer.File[];
  imageHot?: Express.Multer.File[];
  imageCold?: Express.Multer.File[];
};

const productImagesUpload = FileFieldsInterceptor(
  [
    { name: 'image', maxCount: 1 },
    { name: 'imageHot', maxCount: 1 },
    { name: 'imageCold', maxCount: 1 },
  ],
  {
    storage: imageStorage,
    fileFilter: imageFileFilter,
    limits: { fileSize: 5_000_000 },
  },
);

function toProductData(
  dto: Partial<ProductDto> | UpdateProductDto,
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
  };
}

class AvailabilityDto {
  @IsOptional() @Transform(toBool) @IsBoolean() isAvailable?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() isSoldOut?: boolean;
}
const include = {
  category: true,
  customizationGroups: {
    where: { group: { isActive: true } },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      group: {
        include: {
          options: {
            where: { isActive: true, isAvailable: true },
            orderBy: { sortOrder: 'asc' as const },
          },
        },
      },
    },
  },
};

/** Apply per-product option visibility (enabledOptionIds). */
function filterProductOptions<T extends Record<string, unknown>>(product: T): T {
  const links = product.customizationGroups as
    | {
        enabledOptionIds?: string[];
        group?: { options?: { id: string }[] } | null;
      }[]
    | undefined;
  if (!links?.length) return product;
  for (const link of links) {
    const allowed = link.enabledOptionIds ?? [];
    if (!allowed.length || !link.group?.options) continue;
    const allow = new Set(allowed);
    link.group.options = link.group.options.filter((o) => allow.has(o.id));
  }
  return product;
}

/** List/home payload — skip heavy option trees (details loads full include). */
const listInclude = {
  category: true,
};

type ProductMedia = {
  id: string;
  imageUrl?: string | null;
  imageUrlHot?: string | null;
  imageUrlCold?: string | null;
};

async function withPublicImage<T extends ProductMedia>(product: T): Promise<T> {
  const [imageUrl, imageUrlHot, imageUrlCold] = await Promise.all([
    publicMediaUrl(product.imageUrl, `product:${product.id}`),
    publicMediaUrl(product.imageUrlHot, `product-hot:${product.id}`),
    publicMediaUrl(product.imageUrlCold, `product-cold:${product.id}`),
  ]);
  return {
    ...product,
    imageUrl: imageUrl ?? null,
    imageUrlHot: imageUrlHot ?? null,
    imageUrlCold: imageUrlCold ?? null,
  };
}

async function withPublicImages<T extends ProductMedia>(
  products: T[],
): Promise<T[]> {
  return Promise.all(products.map((p) => withPublicImage(p)));
}

async function applyImageFiles(
  data: Prisma.ProductUncheckedCreateInput | Prisma.ProductUncheckedUpdateInput,
  files?: ProductImageFiles,
) {
  const main = files?.image?.[0];
  const hot = files?.imageHot?.[0];
  const cold = files?.imageCold?.[0];
  if (main) data.imageUrl = await toStoredImageUrl(main);
  if (hot) data.imageUrlHot = await toStoredImageUrl(hot);
  if (cold) data.imageUrlCold = await toStoredImageUrl(cold);
}

@Public()
@Controller('products')
class ProductsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@Query('categoryId') categoryId?: string) {
    void ensureProductCustomizationDefaults(this.prisma);
    const rows = serialize(
      await this.prisma.product.findMany({
        where: { isActive: true, ...(categoryId && { categoryId }) },
        include: listInclude,
        orderBy: [{ createdAt: 'desc' }, { sortOrder: 'asc' }],
      }),
    ) as ProductMedia[];
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
    void ensureProductCustomizationDefaults(this.prisma);
    const row = serialize(
      await this.prisma.product.findFirstOrThrow({
        where: { id, isActive: true },
        include,
      }),
    ) as ProductMedia;
    return withPublicImage(filterProductOptions(row));
  }
}

@Roles(...AdminRoles)
@Controller('admin/products')
class AdminProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private async broadcast(product: ProductMedia) {
    const payload = await withPublicImage(serialize(product) as ProductMedia);
    this.realtime.emitMenu('menu.updated', { type: 'product', payload });
  }

  @Get()
  async list() {
    const rows = serialize(
      await this.prisma.product.findMany({
        include: listInclude,
        orderBy: [{ createdAt: 'desc' }, { sortOrder: 'asc' }],
      }),
    ) as ProductMedia[];
    return withPublicImages(rows);
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = serialize(
      await this.prisma.product.findFirstOrThrow({ where: { id }, include }),
    ) as ProductMedia;
    return withPublicImage(row);
  }

  @Roles(...ManagerRoles)
  @Post()
  @UseInterceptors(productImagesUpload)
  async create(
    @Body() dto: ProductDto,
    @UploadedFiles() files?: ProductImageFiles,
  ) {
    const data = toProductData(dto) as Prisma.ProductUncheckedCreateInput;
    await applyImageFiles(data, files);
    if (data.isActive === undefined) data.isActive = true;
    if (data.isAvailable === undefined) data.isAvailable = true;
    if (data.isSoldOut === undefined) data.isSoldOut = false;
    if (data.sortOrder === undefined) {
      const { _min } = await this.prisma.product.aggregate({
        _min: { sortOrder: true },
      });
      data.sortOrder = (_min.sortOrder ?? 1) - 1;
    }
    const product = await this.prisma.product.create({
      data,
      include: listInclude,
    });
    void ensureProductCustomizationDefaults(this.prisma);
    await this.broadcast(product);
    return withPublicImage(serialize(product) as ProductMedia);
  }

  @Roles(...AdminRoles)
  @Patch(':id')
  @UseInterceptors(productImagesUpload)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files?: ProductImageFiles,
  ) {
    const data = toProductData(dto) as Prisma.ProductUncheckedUpdateInput;
    await applyImageFiles(data, files);
    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: listInclude,
    });
    await this.broadcast(product);
    return withPublicImage(serialize(product) as ProductMedia);
  }

  @Roles(...AdminRoles)
  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    const product = await this.prisma.product.update({
      where: { id },
      data: { isActive: false, isAvailable: false, isSoldOut: false },
      include,
    });
    await this.broadcast(product);
    return withPublicImage(serialize(product) as ProductMedia);
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
        ...(dto.isSoldOut === false ? { isActive: true, isAvailable: true } : {}),
      },
      include,
    });
    await this.broadcast(product);
    return withPublicImage(serialize(product) as ProductMedia);
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
    await this.broadcast(product);
    return withPublicImage(serialize(product) as ProductMedia);
  }
}

@Module({
  imports: [RealtimeModule],
  controllers: [ProductsController, AdminProductsController],
})
export class ProductsModule {}
