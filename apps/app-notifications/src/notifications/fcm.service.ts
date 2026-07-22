import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import {
  getMessaging,
  MulticastMessage,
  BatchResponse,
} from 'firebase-admin/messaging';
import { PrismaService } from '@app/common';
import {
  DevicePlatform,
  NotificationStatus,
  NotificationType,
} from '@app/common';
import { notificationMetrics } from './notification-metrics';

export interface SendNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, string>;
  notificationType: NotificationType;
  targetUserId?: string;
  targetDeviceTokens?: string[];
  targetTopic?: string;
}

export interface NotificationDispatchResult {
  targeted: number;
  successCount: number;
  failureCount: number;
  skipped: boolean;
}

interface BatchDispatchResult {
  successCount: number;
  failureCount: number;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (!getApps().length) {
      // Initialize Firebase Admin SDK
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      if (serviceAccountPath) {
        initializeApp({
          credential: cert(serviceAccountPath),
        });
      } else if (serviceAccountKey) {
        const serviceAccount = JSON.parse(serviceAccountKey);
        initializeApp({
          credential: cert(serviceAccount),
        });
      } else {
        this.logger.warn(
          'Firebase credentials not configured. FCM functionality will be disabled.',
        );
        return;
      }

      this.logger.log('Firebase Admin SDK initialized');
    }
  }

  async registerDevice(
    deviceToken: string,
    platform: DevicePlatform,
    notificationTypes: NotificationType[] = [],
    userId?: string,
    appVersion?: string,
    metadata?: any,
    locale: string = 'fr',
  ): Promise<void> {
    try {
      await this.prisma.deviceSubscription.upsert({
        where: { deviceToken },
        update: {
          active: true,
          lastUsed: new Date(),
          notificationTypes,
          userId,
          appVersion,
          metadata,
          locale,
        },
        create: {
          deviceToken,
          platform,
          notificationTypes,
          userId,
          appVersion,
          metadata,
          locale,
        },
      });

      this.logger.log(`Device registered: ${deviceToken.substring(0, 10)}...`);
    } catch (error) {
      this.logger.error('Failed to register device', error);
      throw error;
    }
  }

  async updateDeviceLocale(deviceToken: string, locale: string): Promise<void> {
    try {
      await this.prisma.deviceSubscription.update({
        where: { deviceToken },
        data: { locale },
      });
      this.logger.log(
        `Device locale updated: ${deviceToken.substring(0, 10)}... to ${locale}`,
      );
    } catch (error) {
      this.logger.error('Failed to update device locale', error);
      throw error;
    }
  }

  async unregisterDevice(deviceToken: string): Promise<void> {
    try {
      await this.prisma.deviceSubscription.update({
        where: { deviceToken },
        data: { active: false },
      });

      this.logger.log(
        `Device unregistered: ${deviceToken.substring(0, 10)}...`,
      );
    } catch (error) {
      this.logger.error('Failed to unregister device', error);
      throw error;
    }
  }

  async updateDeviceNotificationTypes(
    deviceToken: string,
    notificationTypes: NotificationType[],
  ): Promise<void> {
    try {
      await this.prisma.deviceSubscription.update({
        where: { deviceToken },
        data: {
          notificationTypes,
          lastUsed: new Date(),
        },
      });

      this.logger.log(
        `Device notification types updated: ${deviceToken.substring(0, 10)}...`,
      );
    } catch (error) {
      this.logger.error('Failed to update device notification types', error);
      throw error;
    }
  }

  async subscribeToTopic(deviceToken: string, topic: string): Promise<void> {
    try {
      const subscription = await this.prisma.deviceSubscription.findUnique({
        where: { deviceToken },
      });

      if (!subscription) {
        throw new Error('Device not registered');
      }

      await this.prisma.topicSubscription.upsert({
        where: {
          deviceSubscriptionId_topic: {
            deviceSubscriptionId: subscription.id,
            topic,
          },
        },
        update: {},
        create: {
          deviceSubscriptionId: subscription.id,
          topic,
        },
      });

      this.logger.log(
        `Device ${deviceToken.substring(0, 10)}... subscribed to topic: ${topic}`,
      );
    } catch (error) {
      this.logger.error('Failed to subscribe to topic', error);
      throw error;
    }
  }

  async unsubscribeFromTopic(
    deviceToken: string,
    topic: string,
  ): Promise<void> {
    try {
      const subscription = await this.prisma.deviceSubscription.findUnique({
        where: { deviceToken },
      });

      if (!subscription) {
        return; // Or throw error if preferred
      }

      await this.prisma.topicSubscription.deleteMany({
        where: {
          deviceSubscriptionId: subscription.id,
          topic,
        },
      });

      this.logger.log(
        `Device ${deviceToken.substring(0, 10)}... unsubscribed from topic: ${topic}`,
      );
    } catch (error) {
      this.logger.error('Failed to unsubscribe from topic', error);
      throw error;
    }
  }

  async getSubscribedTopics(deviceToken: string): Promise<string[]> {
    const subscription = await this.prisma.deviceSubscription.findUnique({
      where: { deviceToken },
      include: {
        topicSubscriptions: true,
      },
    });

    if (!subscription) {
      return [];
    }

    return subscription.topicSubscriptions.map((sub) => sub.topic);
  }

  async subscribeToTopicsBulk(
    deviceToken: string,
    topics: string[],
  ): Promise<void> {
    try {
      const subscription = await this.prisma.deviceSubscription.findUnique({
        where: { deviceToken },
      });

      if (!subscription) {
        throw new Error('Device not registered');
      }

      // Create all topic subscriptions in bulk
      await Promise.all(
        topics.map((topic) =>
          this.prisma.topicSubscription.upsert({
            where: {
              deviceSubscriptionId_topic: {
                deviceSubscriptionId: subscription.id,
                topic,
              },
            },
            update: {},
            create: {
              deviceSubscriptionId: subscription.id,
              topic,
            },
          }),
        ),
      );

      this.logger.log(
        `Device ${deviceToken.substring(0, 10)}... subscribed to ${topics.length} topics`,
      );
    } catch (error) {
      this.logger.error('Failed to bulk subscribe to topics', error);
      throw error;
    }
  }

  async unsubscribeFromTopicsBulk(
    deviceToken: string,
    topics: string[],
  ): Promise<void> {
    try {
      const subscription = await this.prisma.deviceSubscription.findUnique({
        where: { deviceToken },
      });

      if (!subscription) {
        return; // Or throw error if preferred
      }

      // Delete all topic subscriptions in bulk
      await this.prisma.topicSubscription.deleteMany({
        where: {
          deviceSubscriptionId: subscription.id,
          topic: {
            in: topics,
          },
        },
      });

      this.logger.log(
        `Device ${deviceToken.substring(0, 10)}... unsubscribed from ${topics.length} topics`,
      );
    } catch (error) {
      this.logger.error('Failed to bulk unsubscribe from topics', error);
      throw error;
    }
  }

  async getDevicesByTopicGroupedByLocale(
    topic: string,
  ): Promise<Record<string, string[]>> {
    const topicSubscriptions = await this.prisma.topicSubscription.findMany({
      where: {
        topic,
        deviceSubscription: {
          active: true,
        },
      },
      include: {
        deviceSubscription: {
          select: {
            deviceToken: true,
            locale: true,
          },
        },
      },
    });

    const grouped: Record<string, string[]> = {};
    for (const sub of topicSubscriptions) {
      const locale = sub.deviceSubscription.locale || 'en';
      if (!grouped[locale]) {
        grouped[locale] = [];
      }
      grouped[locale].push(sub.deviceSubscription.deviceToken);
    }

    return grouped;
  }

  async sendNotification(
    options: SendNotificationOptions,
  ): Promise<NotificationDispatchResult> {
    const finishDispatch = notificationMetrics.startDispatch(
      options.notificationType,
    );

    if (!getApps().length) {
      finishDispatch('failed');
      throw new ServiceUnavailableException('Firebase is not initialized');
    }

    try {
      let targetDevices: string[] = [];

      if (options.targetDeviceTokens) {
        targetDevices = options.targetDeviceTokens;
      } else if (options.targetTopic) {
        // Get active devices subscribed to this topic
        const topicSubscriptions = await this.prisma.topicSubscription.findMany(
          {
            where: {
              topic: options.targetTopic,
              deviceSubscription: {
                active: true,
              },
            },
            include: {
              deviceSubscription: {
                select: {
                  deviceToken: true,
                },
              },
            },
          },
        );

        targetDevices = topicSubscriptions.map(
          (sub) => sub.deviceSubscription.deviceToken,
        );
      } else {
        // Get active devices subscribed to this notification type
        const subscriptions = await this.prisma.deviceSubscription.findMany({
          where: {
            active: true,
            notificationTypes: {
              has: options.notificationType,
            },
            ...(options.targetUserId && { userId: options.targetUserId }),
          },
          select: {
            id: true,
            deviceToken: true,
          },
        });

        targetDevices = subscriptions.map((sub) => sub.deviceToken);
      }

      if (targetDevices.length === 0) {
        this.logger.log(
          `No active subscriptions found for notification type: ${options.notificationType}`,
        );
        finishDispatch('skipped');
        return {
          targeted: 0,
          successCount: 0,
          failureCount: 0,
          skipped: true,
        };
      }

      // Send notifications in batches (FCM supports up to 500 tokens per batch)
      const batchSize = 500;
      const uniqueTargetDevices = [...new Set(targetDevices)];
      const batches = this.chunkArray(uniqueTargetDevices, batchSize);
      const results = await this.mapWithConcurrency(batches, 3, async (batch) =>
        this.sendBatchNotification(batch, options),
      );
      const result: NotificationDispatchResult = {
        targeted: uniqueTargetDevices.length,
        successCount: results.reduce(
          (total, batch) => total + batch.successCount,
          0,
        ),
        failureCount: results.reduce(
          (total, batch) => total + batch.failureCount,
          0,
        ),
        skipped: false,
      };

      finishDispatch(result.failureCount > 0 ? 'failed' : 'success');
      this.logger.log(
        `Notification dispatch completed: targeted=${result.targeted}, sent=${result.successCount}, failed=${result.failureCount}`,
      );

      if (result.failureCount === result.targeted) {
        throw new ServiceUnavailableException({
          message: 'FCM failed for every target device',
          ...result,
        });
      }

      return result;
    } catch (error) {
      finishDispatch('failed');
      this.logger.error('Failed to send notification', error);
      throw error;
    }
  }

  private async sendBatchNotification(
    deviceTokens: string[],
    options: SendNotificationOptions,
  ): Promise<BatchDispatchResult> {
    const message: MulticastMessage = {
      tokens: deviceTokens,
      notification: {
        title: options.title,
        body: options.body,
      },
      data: {
        notificationType: options.notificationType,
        ...options.data,
      },
      android: {
        priority: 'high',
        notification: {
          priority: 'high',
          defaultSound: true,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: options.title,
              body: options.body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);

      // Log results and handle failed tokens
      return await this.processBatchResponse(deviceTokens, response, options);
    } catch (error) {
      notificationMetrics.recordDeliveries(
        options.notificationType,
        'failed',
        deviceTokens.length,
      );
      this.logger.error('Failed to send batch notification', error);
      await this.persistNotificationLogs(
        deviceTokens.map((deviceToken) => ({
          deviceToken,
          status: NotificationStatus.FAILED,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown FCM error',
        })),
        options,
      );
      return { successCount: 0, failureCount: deviceTokens.length };
    }
  }

  private async processBatchResponse(
    deviceTokens: string[],
    response: BatchResponse,
    options: SendNotificationOptions,
  ): Promise<BatchDispatchResult> {
    const invalidTokens: string[] = [];
    const logs = response.responses.map((result, index) => {
      const deviceToken = deviceTokens[index];
      const errorCode = result.error?.code;
      if (
        errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(deviceToken);
      }

      return {
        deviceToken,
        status: result.success
          ? NotificationStatus.SENT
          : NotificationStatus.FAILED,
        errorMessage: result.error?.message,
        fcmMessageId: result.messageId,
      };
    });

    const persistenceResults = await Promise.allSettled([
      this.persistNotificationLogs(logs, options),
      invalidTokens.length > 0
        ? this.prisma.deviceSubscription.updateMany({
            where: { deviceToken: { in: invalidTokens } },
            data: { active: false },
          })
        : Promise.resolve(),
    ]);

    for (const persistenceResult of persistenceResults) {
      if (persistenceResult.status === 'rejected') {
        this.logger.error(
          'Failed to persist FCM delivery side effects',
          persistenceResult.reason,
        );
      }
    }

    if (response.failureCount > 0) {
      this.logger.warn(`Failed to send to ${response.failureCount} tokens`);
    }
    if (
      invalidTokens.length > 0 &&
      persistenceResults[1].status === 'fulfilled'
    ) {
      this.logger.warn(`Disabled ${invalidTokens.length} invalid FCM tokens`);
    }

    notificationMetrics.recordDeliveries(
      options.notificationType,
      'sent',
      response.successCount,
    );
    notificationMetrics.recordDeliveries(
      options.notificationType,
      'failed',
      response.failureCount,
    );

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  }

  private async persistNotificationLogs(
    logs: Array<{
      deviceToken: string;
      status: NotificationStatus;
      errorMessage?: string;
      fcmMessageId?: string;
    }>,
    options: SendNotificationOptions,
  ): Promise<void> {
    try {
      const subscriptions = await this.prisma.deviceSubscription.findMany({
        where: { deviceToken: { in: logs.map((log) => log.deviceToken) } },
        select: { id: true, deviceToken: true },
      });
      const subscriptionIds = new Map(
        subscriptions.map((subscription) => [
          subscription.deviceToken,
          subscription.id,
        ]),
      );

      await this.prisma.notificationLog.createMany({
        data: logs.map((log) => ({
          deviceSubscriptionId: subscriptionIds.get(log.deviceToken),
          notificationType: options.notificationType,
          title: options.title,
          body: options.body,
          data: options.data,
          status: log.status,
          errorMessage: log.errorMessage,
          fcmMessageId: log.fcmMessageId,
        })),
      });
    } catch (error) {
      this.logger.error('Failed to persist notification logs', error);
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
        while (nextIndex < items.length) {
          const index = nextIndex++;
          results[index] = await mapper(items[index]);
        }
      },
    );
    await Promise.all(workers);
    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async getActiveSubscriptions(
    notificationType?: NotificationType,
  ): Promise<any[]> {
    return this.prisma.deviceSubscription.findMany({
      where: {
        active: true,
        ...(notificationType && {
          notificationTypes: {
            has: notificationType,
          },
        }),
      },
      include: {
        _count: {
          select: {
            notificationLogs: true,
          },
        },
      },
    });
  }

  async countActiveSubscriptions(): Promise<number> {
    return this.prisma.deviceSubscription.count({ where: { active: true } });
  }

  isFirebaseAvailable(): boolean {
    return getApps().length > 0;
  }

  async getNotificationStats(deviceToken?: string): Promise<any> {
    const where = deviceToken
      ? {
          deviceSubscription: {
            deviceToken,
          },
        }
      : {};

    const stats = await this.prisma.notificationLog.groupBy({
      by: ['status', 'notificationType'],
      where,
      _count: {
        _all: true,
      },
    });

    return stats;
  }
}
