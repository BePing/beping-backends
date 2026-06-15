import { Injectable, Module } from '@nestjs/common';
import { CacheService } from './cache/cache.service';
import { FirebaseModule } from './firebase/firebase.module';
import { EventBusService } from './event-bus/event-bus.service';
import {
  CacheModule,
  CacheModuleOptions,
  CacheOptionsFactory,
} from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import memoryStore from 'cache-manager-memory-store';
import { redisStore } from 'cache-manager-redis-store';
import { PrismaService } from '@app/common';
import { OpenAIService } from './openai.service';

@Injectable()
export class CacheModuleOptsFactory implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  async createCacheOptions(): Promise<CacheModuleOptions<Record<string, any>>> {
    if (this.configService.get('REDIS_TLS_URL')) {
      return {
        store: (await redisStore({
          url: this.configService.get('REDIS_TLS_URL'),
        })) as unknown as any,
      };
    } else {
      return {
        store: memoryStore,
      };
    }
  }
}

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
