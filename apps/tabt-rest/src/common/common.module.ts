import { Module, Provider } from '@nestjs/common';
import { CacheService } from '@app/common';
import { ContextService } from './context/context.service';
import { CredentialsService } from './tabt-client/credentials.service';
import { DatabaseContextService } from './context/database-context.service';
import { TabtClientService } from './tabt-client/tabt-client.service';
import { TabtClientSwitchingService } from './tabt-client/tabt-client-switching.service';
import { PackageService } from './package/package.service';
import { TABT_HEADERS } from './context/context.constants';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { SocksProxyHttpClient } from './socks-proxy/socks-proxy-http-client';
import { createSoapClient } from './tabt-client/soap-client.factory';
import { CacheModuleOptsFactory } from '@app/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import {
  getRedisConnectionOptions,
  PostHogService,
  PrismaService,
} from '@app/common';
import { MemberService } from '../services/members/member.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

const asyncProviders: Provider[] = [
  {
    provide: 'tabt-aftt',
    useFactory: async (
      configService: ConfigService,
      socksProxy: SocksProxyHttpClient,
    ) => {
      return createSoapClient(
        configService.get('AFTT_WSDL'),
        configService.get('USE_SOCKS_PROXY') === 'true'
          ? socksProxy
          : undefined,
      );
    },
    inject: [ConfigService, SocksProxyHttpClient],
  },
  {
    provide: 'tabt-vttl',
    useFactory: async (
      configService: ConfigService,
      socksProxy: SocksProxyHttpClient,
    ) => {
      return createSoapClient(
        configService.get('VTLL_WSDL'),
        configService.get('USE_SOCKS_PROXY') === 'true'
          ? socksProxy
          : undefined,
      );
    },
    inject: [ConfigService, SocksProxyHttpClient],
  },
  {
    provide: 'TABT_HEADERS',
    useValue: TABT_HEADERS,
  },
];

@Module({
  imports: [
    HttpModule,
    ClientsModule.registerAsync({
      clients: [
        {
          name: 'BEPING_NOTIFIER',
          useFactory: (configService: ConfigService) => {
            return {
              transport: Transport.REDIS,
              options: getRedisConnectionOptions((key) =>
                configService.get<string>(key),
              ),
            };
          },
          inject: [ConfigService],
          imports: [ConfigModule],
        },
      ],
    }),
    CacheModule.registerAsync({
      useClass: CacheModuleOptsFactory,
      imports: [ConfigModule],
    }),
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        //transport: { target: 'pino-pretty' },
        quietReqLogger: true,
        redact: {
          paths: ['req.headers.x-tabt-password'],
          censor: '[Redacted]',
        },
        serializers: {
          req: pino.stdSerializers.req,
          err: pino.stdSerializers.err,
          res: pino.stdSerializers.res,
        },
      },
    }),
  ],
  providers: [
    ...asyncProviders,
    CacheService,
    ContextService,
    CredentialsService,
    DatabaseContextService,
    TabtClientService,
    TabtClientSwitchingService,
    PackageService,
    SocksProxyHttpClient,
    MemberService,
    PrismaService,
    PostHogService,
  ],
  exports: [
    ...asyncProviders,
    CacheService,
    ContextService,
    TabtClientService,
    PackageService,
    SocksProxyHttpClient,
    ConfigModule,
    MemberService,
    PrismaService,
    PostHogService,
    ClientsModule,
  ],
})
export class CommonModule {}
