import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../common/common.module';
import { FcmService } from './fcm.service';

@Module({
  imports: [HttpModule, CommonModule],
  providers: [FcmService],
  exports: [FcmService],
})
export class NotificationsModule {}
