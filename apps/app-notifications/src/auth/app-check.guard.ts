import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { getApps } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';

@Injectable()
export class AppCheckGuard implements CanActivate {
  private readonly logger = new Logger(AppCheckGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!getApps().length) {
      this.logger.warn(
        'Firebase not initialized. App Check verification disabled.',
      );
      return true; // Allow in development/testing without Firebase
    }

    const request = context.switchToHttp().getRequest();
    const appCheckToken = this.extractAppCheckToken(request);

    if (!appCheckToken) {
      throw new UnauthorizedException('App Check token missing');
    }

    try {
      const appCheckClaims = await getAppCheck().verifyToken(appCheckToken);

      // Optionally verify specific app claims using appId
      if (
        process.env.FIREBASE_APP_ID &&
        appCheckClaims.appId !== process.env.FIREBASE_APP_ID
      ) {
        throw new UnauthorizedException('Invalid App Check token app ID');
      }

      this.logger.debug(
        `App Check verification successful for app: ${appCheckClaims.appId}`,
      );

      // Add app check claims to request for potential use in controllers
      request.appCheckClaims = appCheckClaims;

      return true;
    } catch (error) {
      this.logger.error('App Check verification failed', error);
      throw new UnauthorizedException('Invalid App Check token');
    }
  }

  private extractAppCheckToken(request: any): string | null {
    // App Check token is typically sent in the X-Firebase-AppCheck header
    const authHeader = request.headers['x-firebase-appcheck'];

    if (!authHeader) {
      return null;
    }

    return authHeader;
  }
}
