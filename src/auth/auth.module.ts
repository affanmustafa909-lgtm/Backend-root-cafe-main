import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
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
import { createHash, randomBytes } from 'node:crypto';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CurrentUser, Public, Roles } from '../common/auth.js';
import type { JwtUser } from '../common/auth.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { imageFileFilter, imageStorage } from '../uploads/storage.js';
import { toStoredImageUrl } from '../uploads/durable-image.js';

const STAFF_ROLES: Role[] = [Role.OWNER, Role.MANAGER, Role.STAFF];
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

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
export class ChangeCredentialsDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(8) newPassword?: string;
}
export class ForgotPasswordDto {
  @IsEmail() email: string;
  /** Where the reset link should open: admin web portal or customer app. */
  @IsOptional()
  @IsIn(['admin', 'app'])
  audience?: 'admin' | 'app';
}
export class ResetPasswordDto {
  @IsString() @MinLength(20) token: string;
  @IsString() @MinLength(8) password: string;
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
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

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private isStaff(role: Role) {
    return STAFF_ROLES.includes(role);
  }

  private withFeatures<T extends object>(account: T) {
    return {
      ...account,
      features: { reporting: this.config.get<boolean>('reportingEnabled') },
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
    return this.withFeatures(account);
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
    return this.withFeatures(account);
  }

  async changeCredentials(user: JwtUser, dto: ChangeCredentialsDto) {
    const email = dto.email?.trim().toLowerCase();
    const newPassword = dto.newPassword?.trim();
    if (!email && !newPassword)
      throw new BadRequestException('Provide a new email and/or password');

    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    if (email && email !== account.email) {
      const taken = await this.prisma.user.findUnique({ where: { email } });
      if (taken) throw new ConflictException('Email already in use');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(email ? { email } : {}),
        ...(newPassword
          ? { passwordHash: await bcrypt.hash(newPassword, 12) }
          : {}),
      },
      select: userPublicSelect,
    });

    return {
      user: this.withFeatures(updated),
      ...this.token(updated),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const audience = dto.audience === 'app' ? 'app' : 'admin';
    const generic = {
      success: true,
      message:
        'If that email belongs to an account, reset instructions were sent.',
    };

    const user = await this.prisma.user.findUnique({ where: { email } });
    const roleOk =
      !!user &&
      (audience === 'admin'
        ? this.isStaff(user.role)
        : user.role === Role.CUSTOMER);

    if (!user || user.accountStatus !== AccountStatus.ACTIVE || !roleOk) {
      return generic;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const resetUrl =
      audience === 'app'
        ? `${this.config.get<string>('appDeepLinkBase')}reset-password?token=${rawToken}`
        : `${this.config.get<string>('adminPortalUrl')}/reset-password?token=${rawToken}`;

    const subject =
      audience === 'app'
        ? 'Reset your Roots Café password'
        : 'Reset your Roots Café admin password';
    const text = [
      `Hi ${user.name},`,
      '',
      audience === 'app'
        ? 'We received a request to reset your Roots Café app password.'
        : 'We received a request to reset your Roots Café admin password.',
      'Open this link within 1 hour to choose a new password:',
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n');

    const { sent } = await this.mail.sendMail({
      to: user.email,
      subject,
      text,
    });

    if (!sent) {
      this.logger.warn(`Password reset link for ${user.email}: ${resetUrl}`);
    }

    const isProd = this.config.get<string>('nodeEnv') === 'production';
    return {
      ...generic,
      emailSent: sent,
      ...(!isProd || !sent
        ? { debugResetUrl: resetUrl, debugResetToken: rawToken }
        : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashResetToken(dto.token.trim());
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !record ||
      record.usedAt ||
      record.expiresAt.getTime() < Date.now() ||
      record.user.accountStatus !== AccountStatus.ACTIVE
    ) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await bcrypt.hash(dto.password, 12) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: {
          userId: record.userId,
          usedAt: null,
          id: { not: record.id },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Password updated. You can sign in with your new password.',
    };
  }

  async updateAvatar(user: JwtUser, file?: Express.Multer.File) {
    if (!file) throw new HttpException('Image required', HttpStatus.BAD_REQUEST);
    const account = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: await toStoredImageUrl(file) },
      select: userPublicSelect,
    });
    return this.withFeatures(account);
  }

  async clearAvatar(user: JwtUser) {
    const account = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
      select: userPublicSelect,
    });
    return this.withFeatures(account);
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
  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    this.limiter.check(`forgot:${req.ip ?? 'unknown'}`);
    return this.auth.forgotPassword(dto);
  }
  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    this.limiter.check(`reset:${req.ip ?? 'unknown'}`);
    return this.auth.resetPassword(dto);
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
  @Patch('me/credentials')
  changeCredentials(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangeCredentialsDto,
  ) {
    return this.auth.changeCredentials(user, dto);
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
  providers: [AuthService, JwtStrategy, LoginRateLimiter, MailService],
  exports: [JwtModule],
})
export class AuthModule {}
