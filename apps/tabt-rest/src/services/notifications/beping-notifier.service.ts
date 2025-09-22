import { Injectable, Logger } from '@nestjs/common';
import { NotificationAcknolwedgement } from './models/notification-ack.model';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, map } from 'rxjs';
import { AxiosError } from 'axios';

interface NumericRankingUpdatePayload {
  uniqueIndex: number;
  oldRanking: number;
  newRanking: number;
}

@Injectable()
export class BepingNotifierService {
  private readonly logger = new Logger(BepingNotifierService.name);
  private readonly notificationURL: string;
  private readonly isDevMode: boolean;

  constructor(
    private readonly httpClient: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.notificationURL = this.configService.get<string>(
      'BEPING_NOTIFICATION_URL',
    );
    this.isDevMode = this.configService.get('NODE_ENV') === 'dev';

    if (!this.notificationURL && !this.isDevMode) {
      throw new Error('BEPING_NOTIFICATION_URL is not configured');
    }
  }

  async notifyNumericRankingChanged(
    uniqueIndex: number,
    oldRanking: number,
    newRanking: number,
  ): Promise<NotificationAcknolwedgement | null> {
    if (!this.isValidRankingUpdate(uniqueIndex, oldRanking, newRanking)) {
      return null;
    }

    const payload: NumericRankingUpdatePayload = {
      uniqueIndex,
      oldRanking,
      newRanking,
    };

    try {
      const ack = await this.sendNotification(
        'numeric-ranking/update',
        payload,
      );
      this.logger.debug(
        `Numeric ranking update acknowledged for player ${uniqueIndex}: ${ack?.acknolwedgedId ?? 'no acknowledgement'}`,
      );
      return ack;
    } catch (error) {
      const errorMessage =
        error instanceof AxiosError
          ? `${error.message} (Status: ${error.response?.status})`
          : error.message;

      this.logger.error(
        `Failed to send numeric ranking update notification for player ${uniqueIndex}: ${errorMessage}`,
        error.stack,
      );
      return { sent: false };
    }
  }

  private isValidRankingUpdate(
    uniqueIndex: number,
    oldRanking: number,
    newRanking: number,
  ): boolean {
    if (!uniqueIndex || !oldRanking || !newRanking) {
      this.logger.debug(
        `Invalid ranking update parameters: uniqueIndex=${uniqueIndex}, oldRanking=${oldRanking}, newRanking=${newRanking}`,
      );
      return false;
    }

    if (oldRanking === newRanking) {
      this.logger.debug(
        `Skipping notification for unchanged ranking: ${oldRanking}`,
      );
      return false;
    }

    return true;
  }

  private async sendNotification<T>(
    endpoint: string,
    payload: T,
  ): Promise<NotificationAcknolwedgement | null> {
    if (this.isDevMode) {
      this.logger.debug(
        `[DEV MODE] Notification skipped for endpoint: ${endpoint}`,
        { payload },
      );
      return null;
    }

    const auth = {
      username: this.configService.get<string>(
        'BEPING_NOTIFICATION_CONSUMER_KEY',
      ),
      password: this.configService.get<string>(
        'BEPING_NOTIFICATION_CONSUMER_SECRET',
      ),
    };

    if (!auth.username || !auth.password) {
      throw new Error('Notification credentials are not properly configured');
    }

    return firstValueFrom(
      this.httpClient
        .post<NotificationAcknolwedgement>(
          `${this.notificationURL}${endpoint}`,
          payload,
          { auth },
        )
        .pipe(map((response) => response.data)),
    );
  }
}
