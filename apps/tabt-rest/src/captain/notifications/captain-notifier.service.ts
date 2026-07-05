import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export type CaptainNotificationType =
  | 'CAPTAIN_AVAILABILITY_REQUEST'
  | 'CAPTAIN_CONVOCATION'
  | 'CAPTAIN_LINEUP_REMINDER';

export interface CaptainNotification {
  type: CaptainNotificationType;
  title: string;
  body: string;
  targetUniqueIndex: number;
  matchUniqueId: number;
  deepLink: string;
  responseToken?: string;
}

/**
 * Sends captain notifications through the app-notifications service
 * (POST /notifications/send, Basic auth). Best-effort: a notification failure
 * never blocks the captain action.
 */
@Injectable()
export class CaptainNotifierService {
  private readonly logger = new Logger(CaptainNotifierService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async send(notification: CaptainNotification): Promise<boolean> {
    const baseUrl = this.config.get<string>('NOTIFICATIONS_API_URL');
    const user = this.config.get<string>('NOTIFICATIONS_API_USER');
    const password = this.config.get<string>('NOTIFICATIONS_API_PASSWORD');
    if (!baseUrl || !user || !password) {
      this.logger.warn(
        'app-notifications not configured (NOTIFICATIONS_API_*) — skipping push',
      );
      return false;
    }

    const payload = {
      title: notification.title,
      body: notification.body,
      notificationType: notification.type,
      targetUserId: String(notification.targetUniqueIndex),
      data: {
        type: notification.type,
        matchUniqueId: String(notification.matchUniqueId),
        deepLink: notification.deepLink,
        ...(notification.responseToken
          ? { responseToken: notification.responseToken }
          : {}),
      },
    };

    try {
      await firstValueFrom(
        this.http.post(`${baseUrl}/notifications/send`, payload, {
          auth: { username: user, password },
        }),
      );
      this.logger.debug(
        `Sent ${notification.type} to user ${notification.targetUniqueIndex} (match ${notification.matchUniqueId})`,
      );
      return true;
    } catch (e) {
      this.logger.error(
        `Failed to send ${notification.type} notification to user ${notification.targetUniqueIndex}: ${e?.message ?? 'unknown'}`,
      );
      return false;
    }
  }

  async sendMany(notifications: CaptainNotification[]): Promise<number> {
    if (notifications.length === 0) {
      this.logger.warn('sendMany called with no recipients — nothing to send');
      return 0;
    }
    const type = notifications[0].type;
    this.logger.log(
      `Dispatching ${notifications.length} ${type} notification(s) to app-notifications`,
    );
    const results = await Promise.all(notifications.map((n) => this.send(n)));
    const sent = results.filter(Boolean).length;
    this.logger.log(
      `Dispatched ${type}: ${sent}/${notifications.length} accepted by app-notifications`,
    );
    return sent;
  }
}
