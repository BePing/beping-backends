import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  ArrayMaxSize,
  ArrayUnique,
  IsNotEmpty,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';
import { DevicePlatform, NotificationType } from '@app/common';

const MaxJsonBytes = (maxBytes: number): PropertyDecorator =>
  ValidateBy({
    name: 'maxJsonBytes',
    constraints: [maxBytes],
    validator: {
      validate: (value: unknown) => {
        try {
          return Buffer.byteLength(JSON.stringify(value), 'utf8') <= maxBytes;
        } catch {
          return false;
        }
      },
      defaultMessage: () => `JSON payload must not exceed ${maxBytes} bytes`,
    },
  });

const IsStringRecord = (): PropertyDecorator =>
  ValidateBy({
    name: 'isStringRecord',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every((item) => typeof item === 'string'),
      defaultMessage: () => 'data values must all be strings',
    },
  });

export class RegisterDeviceDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  deviceToken: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(NotificationType, { each: true })
  @IsOptional()
  notificationTypes?: NotificationType[];

  @IsString()
  @MaxLength(128)
  @IsOptional()
  userId?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  appVersion?: string;

  @IsString()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  @IsOptional()
  locale?: string;

  @IsObject()
  @MaxJsonBytes(4096)
  @IsOptional()
  metadata?: any;
}

export class UpdateNotificationTypesDto {
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(NotificationType, { each: true })
  notificationTypes: NotificationType[];
}

export class UpdateDeviceLocaleDto {
  @IsString()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  locale: string;
}

export class SubscribeTopicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(900)
  @Matches(/^[a-zA-Z0-9-_.~%]+$/)
  topic: string;
}

export class UnsubscribeTopicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(900)
  @Matches(/^[a-zA-Z0-9-_.~%]+$/)
  topic: string;
}

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;

  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @IsObject()
  @IsStringRecord()
  @MaxJsonBytes(4096)
  @IsOptional()
  data?: Record<string, string>;

  @IsString()
  @MaxLength(128)
  @IsOptional()
  targetUserId?: string;

  @IsArray()
  @ArrayMaxSize(5000)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(20, { each: true })
  @MaxLength(4096, { each: true })
  @IsOptional()
  targetDeviceTokens?: string[];
}
