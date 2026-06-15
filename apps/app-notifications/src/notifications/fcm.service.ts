import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '@app/common';
import {
  DevicePlatform,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';

export interface SendNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, string>;
  notificationType: NotificationType;
  targetUserId?: string;
  targetDeviceTokens?: string[];
  targetTopic?: string;
}

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (!admin.apps.length) {
      // Initialize Firebase Admin SDK
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      if (serviceAccountPath) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
        });
      } else if (serviceAccountKey) {
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
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

  async sendNotification(options: SendNotificationOptions): Promise<void> {
    if (!admin.apps.length) {
      this.logger.warn('Firebase not initialized. Skipping notification.');
      return;
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
        return;
      }

      // Send notifications in batches (FCM supports up to 500 tokens per batch)
      const batchSize = 500;
      const batches = this.chunkArray(targetDevices, batchSize);

      for (const batch of batches) {
        await this.sendBatchNotification(batch, options);
      }

      this.logger.log(`Notification sent to ${targetDevices.length} devices`);
    } catch (error) {
      this.logger.error('Failed to send notification', error);
      throw error;
    }
  }

  private async sendBatchNotification(
    deviceTokens: string[],
    options: SendNotificationOptions,
  ): Promise<void> {
    const message: admin.messaging.MulticastMessage = {
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
      const response = await admin.messaging().sendMulticast(message);

      // Log results and handle failed tokens
      await this.processBatchResponse(deviceTokens, response, options);
    } catch (error) {
      this.logger.error('Failed to send batch notification', error);

      // Log failed notifications
      for (const token of deviceTokens) {
        await this.logNotification(token, options, 'FAILED', error.message);
      }
    }
  }

  private async processBatchResponse(
    deviceTokens: string[],
    response: admin.messaging.BatchResponse,
    options: SendNotificationOptions,
  ): Promise<void> {
    const failedTokens: string[] = [];

    for (let i = 0; i < response.responses.length; i++) {
      const result = response.responses[i];
      const token = deviceTokens[i];

      if (result.success) {
        await this.logNotification(
          token,
          options,
          'SENT',
          undefined,
          result.messageId,
        );
      } else {
        const error = result.error;
        failedTokens.push(token);

        // Handle specific error codes
        if (
          error?.code === 'messaging/registration-token-not-registered' ||
          error?.code === 'messaging/invalid-registration-token'
        ) {
          // Remove invalid tokens
          await this.unregisterDevice(token);
          this.logger.warn(
            `Removed invalid token: ${token.substring(0, 10)}...`,
          );
        }

        await this.logNotification(token, options, 'FAILED', error?.message);
      }
    }

    if (failedTokens.length > 0) {
      this.logger.warn(`Failed to send to ${failedTokens.length} tokens`);
    }
  }

  private async logNotification(
    deviceToken: string,
    options: SendNotificationOptions,
    status: NotificationStatus,
    errorMessage?: string,
    fcmMessageId?: string,
  ): Promise<void> {
    try {
      const subscription = await this.prisma.deviceSubscription.findUnique({
        where: { deviceToken },
        select: { id: true },
      });

      await this.prisma.notificationLog.create({
        data: {
          deviceSubscriptionId: subscription?.id,
          notificationType: options.notificationType,
          title: options.title,
          body: options.body,
          data: options.data,
          status,
          errorMessage,
          fcmMessageId,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log notification', error);
    }
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
