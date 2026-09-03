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
    ...(file ? { imageUrl: `/uploads/${file.filename}` } : {}),
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

@Public()
@Controller('products')
class ProductsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async list(@Query('categoryId') categoryId?: string) {
    await ensureProductCustomizationDefaults(this.prisma);
    return serialize(
      await this.prisma.product.findMany({
        where: { isActive: true, ...(categoryId && { categoryId }) },
        include,
        orderBy: [{ createdAt: 'desc' }, { sortOrder: 'asc' }],
      }),
    );
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
    return serialize(
      await this.prisma.product.findFirstOrThrow({
        where: { id, isActive: true },
        include,
      }),
    );
  }
}

@Roles(...AdminRoles)
@Controller('admin/products')
class AdminProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private broadcast(product: unknown) {
    const payload = serialize(product);
    this.realtime.emitMenu('product.availability_changed', payload);
    this.realtime.emitMenu('menu.updated', { type: 'product', payload });
  }

  @Get()
  async list() {
    return serialize(await this.prisma.product.findMany({ include }));
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    return serialize(
      await this.prisma.product.findFirstOrThrow({ where: { id }, include }),
    );
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
    this.broadcast(withGroups);
    return serialize(withGroups);
  }

  @Roles(...AdminRoles)
  @Patch(':id')
  @UseInterceptors(imageUpload)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const product = await this.prisma.product.update({
      where: { id },
      data: toProductData(dto, file),
      include,
    });
    this.broadcast(product);
    return serialize(product);
  }

  @Roles(...AdminRoles)
  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    const product = await this.prisma.product.update({
      where: { id },
      data: { isActive: false, isAvailable: false, isSoldOut: false },
      include,
    });
    this.broadcast(product);
    return serialize(product);
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
    this.broadcast(product);
    return serialize(product);
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
      data: { imageUrl: `/uploads/${file.filename}` },
      include,
    });
    this.broadcast(product);
    return serialize(product);
  }
}

@Module({
  imports: [RealtimeModule],
  controllers: [ProductsController, AdminProductsController],
})
export class ProductsModule {}
