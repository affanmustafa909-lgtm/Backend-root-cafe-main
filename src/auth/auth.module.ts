import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccountStatus, Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CurrentUser, Public, Roles } from '../common/auth.js';
import type { JwtUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { imageFileFilter, imageStorage } from '../uploads/storage.js';
import { toStoredImageUrl } from '../uploads/durable-image.js';

export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @Length(2, 100) name: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() phone?: string;
}
export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
export class UpdateProfileDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() phone?: string;
}

const avatarUpload = FileInterceptor('image', {
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 3_000_000 },
});

const userPublicSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  avatarUrl: true,
  role: true,
} as const;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwtSecret')!,
    });
  }

  async validate(payload: { sub: string; email: string; role: Role }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.accountStatus !== AccountStatus.ACTIVE)
      throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role };
  }
}

@Injectable()
class LoginRateLimiter {
  private readonly attempts = new Map<string, { count: number; reset: number }>();
  check(key: string) {
    const now = Date.now();
    const state = this.attempts.get(key);
    if (!state || state.reset <= now) {
      this.attempts.set(key, { count: 1, reset: now + 60_000 });
      return;
    }
    if (++state.count > 10)
      throw new HttpException(
        'Too many login attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
}

@Injectable()
class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private token(user: JwtUser) {
    return {
      accessToken: this.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException('Email already registered');
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        phone: dto.phone,
        role: Role.CUSTOMER,
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
    });
    return this.token(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (
      !user ||
      user.accountStatus !== AccountStatus.ACTIVE ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    )
      throw new UnauthorizedException('Invalid credentials');
    return this.token(user);
  }

  async me(user: JwtUser) {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: userPublicSelect,
    });
    return {
      ...account,
      features: { reporting: this.config.get<boolean>('reportingEnabled') },
    };
  }

  async updateProfile(user: JwtUser, dto: UpdateProfileDto) {
    const account = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() || null }),
      },
      select: userPublicSelect,
    });
    return {
      ...account,
      features: { reporting: this.config.get<boolean>('reportingEnabled') },
    };
  }

  async updateAvatar(user: JwtUser, file?: Express.Multer.File) {
    if (!file) throw new HttpException('Image required', HttpStatus.BAD_REQUEST);
    const account = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: await toStoredImageUrl(file) },
      select: userPublicSelect,
    });
    return {
      ...account,
      features: { reporting: this.config.get<boolean>('reportingEnabled') },
    };
  }

  async clearAvatar(user: JwtUser) {
    const account = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
      select: userPublicSelect,
    });
    return {
      ...account,
      features: { reporting: this.config.get<boolean>('reportingEnabled') },
    };
  }

  async deleteAccount(user: JwtUser) {
    if (user.role !== Role.CUSTOMER)
      throw new UnauthorizedException('Only customer accounts can be deleted here');
    await this.prisma.$transaction(async (tx) => {
      await tx.deviceToken.deleteMany({ where: { userId: user.id } });
      await tx.notification.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          accountStatus: AccountStatus.DISABLED,
          email: `deleted+${user.id}@rootscafe.local`,
          name: 'Deleted User',
          phone: null,
          avatarUrl: null,
          passwordHash: await bcrypt.hash(`deleted-${user.id}-${Date.now()}`, 12),
        },
      });
    });
    return { success: true };
  }
}

@Controller('auth')
class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly limiter: LoginRateLimiter,
  ) {}
  @Public() @Post('register') register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  @Public() @Post('login') login(@Body() dto: LoginDto, @Req() req: Request) {
    this.limiter.check(req.ip ?? 'unknown');
    return this.auth.login(dto);
  }
  @Post('logout') logout() {
    return { success: true };
  }
  @Get('me') me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user);
  }
  @Patch('me') updateMe(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(user, dto);
  }
  @Patch('me/avatar')
  @UseInterceptors(avatarUpload)
  updateAvatar(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.auth.updateAvatar(user, file);
  }
  @Patch('me/avatar/clear')
  clearAvatar(@CurrentUser() user: JwtUser) {
    return this.auth.clearAvatar(user);
  }
  @Delete('me')
  @Roles(Role.CUSTOMER)
  deleteMe(@CurrentUser() user: JwtUser) {
    return this.auth.deleteAccount(user);
  }
}

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret'),
        signOptions: {
          expiresIn: config.get('jwtExpiresIn'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginRateLimiter],
  exports: [JwtModule],
})
export class AuthModule {}
