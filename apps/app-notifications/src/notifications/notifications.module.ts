import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../common/common.module';
import { FcmService } from './fcm.service';
import { NotificationContentService } from './notification-content.service';
import { NotificationOutboxService } from './notification-outbox.service';

@Module({
  imports: [HttpModule, CommonModule],
  providers: [
    FcmService,
    NotificationContentService,
    NotificationOutboxService,
  ],
  exports: [FcmService, NotificationContentService],
})
export class NotificationsModule {}
