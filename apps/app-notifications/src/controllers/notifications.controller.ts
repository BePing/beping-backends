import {
  Controller,
  Post,
  Body,
  Delete,
  Param,
  Put,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FcmService } from '../notifications/fcm.service';
import {
  RegisterDeviceDto,
  UpdateNotificationTypesDto,
  SendNotificationDto,
  SubscribeTopicDto,
  UpdateDeviceLocaleDto,
} from './dto/device-registration.dto';
import { BulkTopicSubscriptionDto } from './dto/bulk-topic.dto';
import { NotificationType } from '@prisma/client';
import { AppCheckGuard } from '../auth/app-check.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly fcmService: FcmService) { }

  // Mobile app endpoints - protected by App Check
  @Post('devices/register')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.CREATED)
  async registerDevice(@Body() registerDeviceDto: RegisterDeviceDto) {
    await this.fcmService.registerDevice(
      registerDeviceDto.deviceToken,
      registerDeviceDto.platform,
      registerDeviceDto.notificationTypes || [],
      registerDeviceDto.userId,
      registerDeviceDto.appVersion,
      registerDeviceDto.metadata,
      registerDeviceDto.locale,
    );

    return { message: 'Device registered successfully' };
  }

  @Put('devices/:deviceToken/locale')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.OK)
  async updateDeviceLocale(
    @Param('deviceToken') deviceToken: string,
    @Body() updateDto: UpdateDeviceLocaleDto,
  ) {
    await this.fcmService.updateDeviceLocale(deviceToken, updateDto.locale);
    return { message: 'Device locale updated successfully' };
  }

  @Delete('devices/:deviceToken')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unregisterDevice(@Param('deviceToken') deviceToken: string) {
    await this.fcmService.unregisterDevice(deviceToken);
  }

  @Put('devices/:deviceToken/notification-types')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.OK)
  async updateNotificationTypes(
    @Param('deviceToken') deviceToken: string,
    @Body() updateDto: UpdateNotificationTypesDto,
  ) {
    await this.fcmService.updateDeviceNotificationTypes(
      deviceToken,
      updateDto.notificationTypes,
    );

    return { message: 'Notification types updated successfully' };
  }

  @Post('devices/:deviceToken/topics')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.OK)
  async subscribeToTopic(
    @Param('deviceToken') deviceToken: string,
    @Body() subscribeDto: SubscribeTopicDto,
  ) {
    await this.fcmService.subscribeToTopic(deviceToken, subscribeDto.topic);
    return { message: `Subscribed to topic: ${subscribeDto.topic}` };
  }

  @Delete('devices/:deviceToken/topics/:topic')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribeFromTopic(
    @Param('deviceToken') deviceToken: string,
    @Param('topic') topic: string,
  ) {
    await this.fcmService.unsubscribeFromTopic(deviceToken, topic);
  }

  @Get('devices/:deviceToken/topics')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.OK)
  async getSubscribedTopics(@Param('deviceToken') deviceToken: string) {
    const topics = await this.fcmService.getSubscribedTopics(deviceToken);
    return { topics };
  }

  @Post('devices/:deviceToken/topics/bulk')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.OK)
  async subscribeToTopicsBulk(
    @Param('deviceToken') deviceToken: string,
    @Body() bulkDto: BulkTopicSubscriptionDto,
  ) {
    await this.fcmService.subscribeToTopicsBulk(deviceToken, bulkDto.topics);
    return {
      message: `Subscribed to ${bulkDto.topics.length} topics`,
      topics: bulkDto.topics,
    };
  }

  @Delete('devices/:deviceToken/topics/bulk')
  @UseGuards(AppCheckGuard)
  @HttpCode(HttpStatus.OK)
  async unsubscribeFromTopicsBulk(
    @Param('deviceToken') deviceToken: string,
    @Body() bulkDto: BulkTopicSubscriptionDto,
  ) {
    await this.fcmService.unsubscribeFromTopicsBulk(deviceToken, bulkDto.topics);
    return {
      message: `Unsubscribed from ${bulkDto.topics.length} topics`,
      topics: bulkDto.topics,
    };
  }

  // Backend service endpoints - protected by Basic Auth
  @Post('send')
  @UseGuards(AuthGuard('basic'))
  @HttpCode(HttpStatus.ACCEPTED)
  async sendNotification(@Body() sendNotificationDto: SendNotificationDto) {
    await this.fcmService.sendNotification({
      title: sendNotificationDto.title,
      body: sendNotificationDto.body,
      notificationType: sendNotificationDto.notificationType,
      data: sendNotificationDto.data,
      targetUserId: sendNotificationDto.targetUserId,
      targetDeviceTokens: sendNotificationDto.targetDeviceTokens,
    });

    return { message: 'Notification sent successfully' };
  }

  @Get('subscriptions')
  @UseGuards(AuthGuard('basic'))
  async getSubscriptions(
    @Query('notificationType') notificationType?: NotificationType,
  ) {
    const subscriptions =
      await this.fcmService.getActiveSubscriptions(notificationType);

    return {
      subscriptions,
      total: subscriptions.length,
    };
  }

  @Get('stats')
  @UseGuards(AuthGuard('basic'))
  async getNotificationStats(@Query('deviceToken') deviceToken?: string) {
    const stats = await this.fcmService.getNotificationStats(deviceToken);

    return { stats };
  }

  // Public health check endpoint
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    try {
      const subscriptions = await this.fcmService.getActiveSubscriptions();
      return {
        status: 'healthy',
        activeSubscriptions: subscriptions.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
