import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface CaptainAccessClaims {
  sub: number; // uniqueIndex
  club: string; // clubIndex
  jti: string;
}

export interface CaptainRefreshClaims {
  sub: number;
  club: string;
  jti: string;
  typ: 'refresh';
}

export type ResponseTokenPurpose = 'availability' | 'convocation';

export interface ResponseTokenClaims {
  matchUniqueId: number;
  uniqueIndex: number;
  purpose: ResponseTokenPurpose;
}

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';
const RESPONSE_TTL = '14d';

/**
 * Issues and verifies the captain session tokens (access/refresh) and the
 * scoped player response tokens embedded in push notifications and links.
 * Secrets come from env; sensible dev fallbacks keep local runs working.
 */
@Injectable()
export class CaptainTokenService {
  private readonly logger = new Logger(CaptainTokenService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessSecret =
      this.config.get<string>('CAPTAIN_JWT_SECRET') ??
      'captain-dev-access-secret';
    this.refreshSecret =
      this.config.get<string>('CAPTAIN_JWT_REFRESH_SECRET') ??
      'captain-dev-refresh-secret';
    if (!this.config.get('CAPTAIN_JWT_SECRET')) {
      this.logger.warn(
        'CAPTAIN_JWT_SECRET not set — using an insecure dev secret.',
      );
    }
  }

  async signAccess(uniqueIndex: number, clubIndex: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: uniqueIndex, club: clubIndex, jti: randomUUID() },
      { secret: this.accessSecret, expiresIn: ACCESS_TTL },
    );
  }

  async signRefresh(uniqueIndex: number, clubIndex: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: uniqueIndex, club: clubIndex, jti: randomUUID(), typ: 'refresh' },
      { secret: this.refreshSecret, expiresIn: REFRESH_TTL },
    );
  }

  async verifyAccess(token: string): Promise<CaptainAccessClaims> {
    return this.jwt.verifyAsync<CaptainAccessClaims>(token, {
      secret: this.accessSecret,
    });
  }

  async verifyRefresh(token: string): Promise<CaptainRefreshClaims> {
    return this.jwt.verifyAsync<CaptainRefreshClaims>(token, {
      secret: this.refreshSecret,
    });
  }

  async signResponseToken(claims: ResponseTokenClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      secret: this.accessSecret,
      expiresIn: RESPONSE_TTL,
    });
  }

  async verifyResponseToken(token: string): Promise<ResponseTokenClaims> {
    return this.jwt.verifyAsync<ResponseTokenClaims>(token, {
      secret: this.accessSecret,
    });
  }
}
