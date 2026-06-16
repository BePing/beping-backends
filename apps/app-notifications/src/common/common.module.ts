import { Module } from '@nestjs/common';
import { CacheService } from './cache/cache.service';
import { FirebaseModule } from './firebase/firebase.module';
import { EventBusService } from './event-bus/event-bus.service';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { CacheModuleOptsFactory, PrismaService } from '@app/common';
import { OpenAIService } from './openai.service';

@Module({
  imports: [
    ConfigModule,
    CacheModule.registerAsync({
      useClass: CacheModuleOptsFactory,
      imports: [ConfigModule],
    }),
    FirebaseModule,
  ],
  providers: [CacheService, EventBusService, PrismaService, OpenAIService],
  exports: [
    CacheService,
    FirebaseModule,
    EventBusService,
    PrismaService,
    OpenAIService,
  ],
})
export class CommonModule {}
