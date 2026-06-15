import { Module } from '@nestjs/common';
import { ServicesModule } from './services/services.module';
import { CommonModule } from './common/common.module';
import { ApiModule } from './api/api.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ServicesModule, CommonModule, ApiModule, ConfigModule.forRoot()],
})
export class AppModule {}
