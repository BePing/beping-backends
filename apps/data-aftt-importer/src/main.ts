import { NestFactory } from '@nestjs/core';
import { DataAFTTImporterModule } from './data-aftt-importer.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { getRedisConnectionOptions } from '@app/common';

async function bootstrap() {
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
}

bootstrap();
