import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../common/prisma.service';
import { DevicePlatform, NotificationStatus, NotificationType } from '@prisma/client';

export interface SendNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, string>;
  notificationType: NotificationType;
  targetUserId?: string;
  targetDeviceTokens?: string[];
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
        this.logger.warn('Firebase credentials not configured. FCM functionality will be disabled.');
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
        },
        create: {
          deviceToken,
          platform,
          notificationTypes,
          userId,
          appVersion,
          metadata,
        },
      });

      this.logger.log(`Device registered: ${deviceToken.substring(0, 10)}...`);
    } catch (error) {
      this.logger.error('Failed to register device', error);
      throw error;
    }
  }

  async unregisterDevice(deviceToken: string): Promise<void> {
    try {
      await this.prisma.deviceSubscription.update({
        where: { deviceToken },
        data: { active: false },
      });

      this.logger.log(`Device unregistered: ${deviceToken.substring(0, 10)}...`);
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

      this.logger.log(`Device notification types updated: ${deviceToken.substring(0, 10)}...`);
    } catch (error) {
      this.logger.error('Failed to update device notification types', error);
      throw error;
    }
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

        targetDevices = subscriptions.map(sub => sub.deviceToken);
      }

      if (targetDevices.length === 0) {
        this.logger.log(`No active subscriptions found for notification type: ${options.notificationType}`);
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
        await this.logNotification(token, options, 'SENT', undefined, result.messageId);
      } else {
        const error = result.error;
        failedTokens.push(token);
        
        // Handle specific error codes
        if (error?.code === 'messaging/registration-token-not-registered' ||
            error?.code === 'messaging/invalid-registration-token') {
          // Remove invalid tokens
          await this.unregisterDevice(token);
          this.logger.warn(`Removed invalid token: ${token.substring(0, 10)}...`);
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

  async getActiveSubscriptions(notificationType?: NotificationType): Promise<any[]> {
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
            deviceToken 
          } 
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