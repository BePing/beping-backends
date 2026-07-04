import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Weak Pro gating for v1: requires the header `X-BePing-Pro: true`. This is
 * trivially spoofable and MUST be replaced by a server-side entitlement check
 * (RevenueCat receipt validation) before the Pro intelligence endpoints ship
 * broadly. TODO: real entitlement verification.
 */
@Injectable()
export class CaptainProGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-beping-pro'];
    if (header === 'true') {
      return true;
    }
    throw new ForbiddenException('Pro subscription required');
  }
}
