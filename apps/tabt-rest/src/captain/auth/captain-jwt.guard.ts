import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CaptainTokenService } from './captain-token.service';

export interface CaptainPrincipal {
  uniqueIndex: number;
  clubIndex: string;
}

/**
 * Protects all authenticated captain routes. Verifies the Bearer access token
 * and attaches the principal ({ uniqueIndex, clubIndex }) to the request.
 */
@Injectable()
export class CaptainJwtGuard implements CanActivate {
  constructor(private readonly tokens: CaptainTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string = request.headers['authorization'] ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const claims = await this.tokens.verifyAccess(token);
      request.captain = {
        uniqueIndex: claims.sub,
        clubIndex: claims.club,
      } satisfies CaptainPrincipal;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
