import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import responseTime from 'response-time';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PackageService } from './common/package/package.service';
import { Logger } from 'nestjs-pino';
import { getServiceMetrics } from '@app/common';
import { configureSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    bufferLogs: true,
  });
  const metrics = getServiceMetrics('beping-api');
  metrics.instrumentHttp(app);
  // Configure Express v5 query parser to support nested objects and arrays
  app.set('query parser', 'extended');
  app.useLogger(app.get(Logger));

  const packageService = app.get(PackageService);
  const configService = app.get(ConfigService);
  app.setGlobalPrefix(configService.getOrThrow<string>('API_PREFIX'));
  const trustProxyHops = configService.getOrThrow<number>('TRUST_PROXY_HOPS');
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  app.enableVersioning({
    type: VersioningType.URI,
  });
  configureSwagger(app, packageService.version);
  app.use(compression());
  app.use(helmet());
  app.use(responseTime());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();
  await app.listen(configService.getOrThrow<number>('PORT'));
  await metrics.listen();
}

bootstrap();
