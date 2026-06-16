import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  IsObject,
} from 'class-validator';
import { DevicePlatform, NotificationType } from '@app/common';

export class RegisterDeviceDto {
  @IsString()
  deviceToken: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @IsArray()
  @IsEnum(NotificationType, { each: true })
  @IsOptional()
  notificationTypes?: NotificationType[];

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  appVersion?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class UpdateNotificationTypesDto {
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  notificationTypes: NotificationType[];
}

export class UpdateDeviceLocaleDto {
  @IsString()
  locale: string;
}

export class SubscribeTopicDto {
  @IsString()
  topic: string;
}

export class UnsubscribeTopicDto {
  @IsString()
  topic: string;
}

export class SendNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @IsObject()
  @IsOptional()
  data?: Record<string, string>;

  @IsString()
  @IsOptional()
  targetUserId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetDeviceTokens?: string[];
}
