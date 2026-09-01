import { Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Role } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AuthModule } from '../auth/auth.module.js';

@Injectable()
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeService implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    // Everyone (including guests) receives live menu updates
    await client.join('public:menu');
    try {
      const raw =
        client.handshake.auth?.token ??
        client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!raw) return;
      const user = await this.jwt.verifyAsync<{
        sub: string;
        role: Role;
      }>(raw, { secret: this.config.get<string>('jwtSecret') });
      client.data.user = user;
      await client.join(`customer:${user.sub}`);
      if (
        ([Role.OWNER, Role.MANAGER, Role.STAFF] as Role[]).includes(user.role)
      )
        await client.join('admin:orders');
    } catch {
      // Stay connected as anonymous menu listener
    }
  }

  @SubscribeMessage('orders:subscribe')
  subscribe(@ConnectedSocket() client: Socket) {
    return { success: !!client.data.user };
  }

  emitAdmin(event: string, payload: unknown) {
    this.server?.to('admin:orders').emit(event, payload);
  }

  /** Broadcast menu/product changes to customer app + admin. */
  emitMenu(event: string, payload: unknown) {
    this.server?.to('public:menu').emit(event, payload);
    this.server?.to('admin:orders').emit(event, payload);
  }

  emitCustomer(userId: string, event: string, payload: unknown) {
    this.server?.to(`customer:${userId}`).emit(event, payload);
  }
}

@Module({
  imports: [AuthModule],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
