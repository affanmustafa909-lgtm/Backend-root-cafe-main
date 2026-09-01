import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

export type JwtUser = { id: string; email: string; role: Role };
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata('public', true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser =>
    context.switchToHttp().getRequest<{ user: JwtUser }>().user,
);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [
      context.getHandler(),
      context.getClass(),
    ])) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = JwtUser>(err: unknown, user: TUser): TUser {
    if (err || !user) throw err ?? new UnauthorizedException();
    return user;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<{ user?: JwtUser }>().user;
    return !!user && roles.includes(user.role);
  }
}

export const AdminRoles = [Role.OWNER, Role.MANAGER, Role.STAFF];
export const ManagerRoles = [Role.OWNER, Role.MANAGER];
