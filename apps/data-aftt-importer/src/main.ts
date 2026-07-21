import { NestFactory } from '@nestjs/core';
import { DataAFTTImporterModule } from './data-aftt-importer.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { getRedisConnectionOptions, ServiceMetrics } from '@app/common';

async function bootstrap() {
  const metrics = new ServiceMetrics('beping-importer');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    DataAFTTImporterModule,
    {
      logger: console,
      bufferLogs: false,
      transport: Transport.REDIS,
      options: getRedisConnectionOptions((key) => process.env[key]),
    },
  );

  app.enableShutdownHooks();
  await app.listen();
  await metrics.listen();
}

bootstrap();
