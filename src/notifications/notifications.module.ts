import {
  Body,
  Controller,
  Delete,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationStatus } from '@prisma/client';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { CurrentUser } from '../common/auth.js';
import type { JwtUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  private readonly firebase?: App;
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const projectId = config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) {
      this.firebase =
        getApps()[0] ??
        initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
    }
  }

  async send(
    userId: string,
    type: string,
    title: string,
    body: string,
    payload: Record<string, string> = {},
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, payload },
    });
    if (!this.firebase) return notification;
    const tokens = await this.prisma.deviceToken.findMany({ where: { userId } });
    if (!tokens.length) return notification;
    try {
      await getMessaging(this.firebase).sendEachForMulticast({
        tokens: tokens.map(({ token }) => token),
        notification: { title, body },
        data: payload,
      });
      return this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT },
      });
    } catch {
      return this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED },
      });
    }
  }
}

@Controller('device-tokens')
class DeviceTokensController {
  constructor(private readonly prisma: PrismaService) {}
  @Post()
  register(
    @CurrentUser() user: JwtUser,
    @Body() dto: { token: string; platform?: string },
  ) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { userId: user.id, platform: dto.platform },
      create: { userId: user.id, ...dto },
    });
  }
  @Delete()
  async remove(
    @CurrentUser() user: JwtUser,
    @Body() dto: { token: string },
  ) {
    await this.prisma.deviceToken.deleteMany({
      where: { userId: user.id, token: dto.token },
    });
    return { success: true };
  }
}

@Module({
  controllers: [DeviceTokensController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
