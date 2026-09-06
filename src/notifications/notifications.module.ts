import {
  Body,
  Controller,
  Delete,
  Injectable,
  Module,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, NotificationStatus, Role } from '@prisma/client';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { CurrentUser } from '../common/auth.js';
import type { JwtUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

function isExpoPushToken(token: string) {
  return (
    token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
  );
}

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
    const tokens = await this.prisma.deviceToken.findMany({ where: { userId } });
    if (!tokens.length) return notification;

    const expoTokens = tokens
      .map((t) => t.token)
      .filter((t) => isExpoPushToken(t));
    const fcmTokens = tokens
      .map((t) => t.token)
      .filter((t) => !isExpoPushToken(t));

    let sent = false;
    let failed = false;

    if (expoTokens.length) {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            expoTokens.map((to) => ({
              to,
              title,
              body,
              data: payload,
              sound: 'default',
              channelId: 'orders',
            })),
          ),
        });
        if (res.ok) sent = true;
        else failed = true;
      } catch {
        failed = true;
      }
    }

    if (fcmTokens.length && this.firebase) {
      try {
        await getMessaging(this.firebase).sendEachForMulticast({
          tokens: fcmTokens,
          notification: { title, body },
          data: payload,
          android: { priority: 'high', notification: { channelId: 'orders' } },
        });
        sent = true;
      } catch {
        failed = true;
      }
    } else if (fcmTokens.length && !this.firebase) {
      failed = true;
    }

    if (sent) {
      return this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT },
      });
    }
    if (failed) {
      return this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED },
      });
    }
    return notification;
  }

  /** Push to café staff (OWNER / MANAGER / STAFF) who registered a device. */
  async notifyStaff(
    type: string,
    title: string,
    body: string,
    payload: Record<string, string> = {},
  ) {
    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.OWNER, Role.MANAGER, Role.STAFF] },
        accountStatus: AccountStatus.ACTIVE,
      },
      select: { id: true },
    });
    await Promise.all(
      staff.map((u) => this.send(u.id, type, title, body, payload)),
    );
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
