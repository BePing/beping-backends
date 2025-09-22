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
} from './dto/device-registration.dto';
import { NotificationType } from '@prisma/client';
import { AppCheckGuard } from '../auth/app-check.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly fcmService: FcmService) {}

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
    );

    return { message: 'Device registered successfully' };
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
