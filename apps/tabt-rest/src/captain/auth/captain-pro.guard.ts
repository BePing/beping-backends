import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface RevenueCatEntitlement {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
}

interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement>;
  };
}

/**
 * Verifies Pro access against RevenueCat's server API. The mobile app sends
 * only its RevenueCat App User ID; subscription state is never trusted from a
 * client-controlled boolean or header.
 */
@Injectable()
export class CaptainProGuard implements CanActivate {
  private readonly logger = new Logger(CaptainProGuard.name);
  private readonly cache = new Map<
    string,
    { active: boolean; validUntil: number }
  >();

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const appUserId = request.headers['x-revenuecat-app-user-id'];
    if (typeof appUserId !== 'string' || !appUserId.trim()) {
      throw new ForbiddenException('Pro subscription required');
    }

    const cached = this.cache.get(appUserId);
    if (cached && cached.validUntil > Date.now()) {
      if (cached.active) return true;
      throw new ForbiddenException('Pro subscription required');
    }

    const apiKey = this.config.get<string>('REVENUECAT_SECRET_API_KEY');
    if (!apiKey) {
      this.logger.error('RevenueCat server verification is not configured');
      throw new ForbiddenException('Pro verification unavailable');
    }

    try {
      const response = await firstValueFrom(
        this.http.get<RevenueCatSubscriberResponse>(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
            timeout: 5000,
          },
        ),
      );
      const active = this.hasActiveEntitlement(
        response.data.subscriber?.entitlements ?? {},
      );
      this.cache.set(appUserId, {
        active,
        validUntil: Date.now() + 5 * 60 * 1000,
      });
      if (active) return true;
    } catch (error) {
      this.logger.warn(
        `RevenueCat verification failed: ${error?.message ?? 'unknown'}`,
      );
      throw new ForbiddenException('Pro verification unavailable');
    }

    throw new ForbiddenException('Pro subscription required');
  }

  private hasActiveEntitlement(
    entitlements: Record<string, RevenueCatEntitlement>,
  ): boolean {
    const configuredId = this.config.get<string>('REVENUECAT_ENTITLEMENT_ID');
    const candidates = configuredId
      ? [entitlements[configuredId]].filter(
          (value): value is RevenueCatEntitlement => !!value,
        )
      : Object.values(entitlements);
    const now = Date.now();
    return candidates.some((entitlement) => {
      if (entitlement.expires_date == null) return true;
      const expiry = Date.parse(entitlement.expires_date);
      const graceExpiry = entitlement.grace_period_expires_date
        ? Date.parse(entitlement.grace_period_expires_date)
        : Number.NaN;
      return expiry > now || graceExpiry > now;
    });
  }
}
