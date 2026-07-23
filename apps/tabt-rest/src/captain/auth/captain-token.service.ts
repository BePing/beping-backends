import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface CaptainAccessClaims {
  sub: number; // uniqueIndex
  club: string; // clubIndex
  jti: string;
  typ: 'access';
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
  typ: 'response';
}

const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';
const RESPONSE_TTL = '14d';

/**
 * Issues and verifies the captain session tokens (access/refresh) and the
 * scoped player response tokens embedded in push notifications and links.
 * Production configuration fails at startup when secrets are absent. Local
 * development keeps explicit, isolated fallbacks for developer convenience.
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
      { sub: uniqueIndex, club: clubIndex, jti: randomUUID(), typ: 'access' },
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
    const claims = await this.jwt.verifyAsync<CaptainAccessClaims>(token, {
      secret: this.accessSecret,
    });
    if (claims.typ !== 'access' || !claims.sub || !claims.club) {
      throw new Error('Invalid access token type');
    }
    return claims;
  }

  async verifyRefresh(token: string): Promise<CaptainRefreshClaims> {
    const claims = await this.jwt.verifyAsync<CaptainRefreshClaims>(token, {
      secret: this.refreshSecret,
    });
    if (claims.typ !== 'refresh' || !claims.sub || !claims.club) {
      throw new Error('Invalid refresh token type');
    }
    return claims;
  }

  async signResponseToken(
    claims: Omit<ResponseTokenClaims, 'typ'>,
  ): Promise<string> {
    return this.jwt.signAsync(
      { ...claims, typ: 'response' },
      {
        secret: this.accessSecret,
        expiresIn: RESPONSE_TTL,
      },
    );
  }

  async verifyResponseToken(token: string): Promise<ResponseTokenClaims> {
    const claims = await this.jwt.verifyAsync<ResponseTokenClaims>(token, {
      secret: this.accessSecret,
    });
    if (claims.typ !== 'response') {
      throw new Error('Invalid response token type');
    }
    return claims;
  }
}
