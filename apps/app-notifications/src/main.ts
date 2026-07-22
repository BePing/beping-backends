import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { getRedisConnectionOptions, getServiceMetrics } from '@app/common';

async function bootstrap() {
  // Create HTTP application for external API access
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const metrics = getServiceMetrics('beping-notifications');
  metrics.instrumentHttp(app);
  // Configure Express v5 query parser to support nested objects and arrays
  app.set('query parser', 'extended');

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Connect microservice for internal communication
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: getRedisConnectionOptions((key) => process.env[key]),
  });

  app.enableShutdownHooks();
  await app.startAllMicroservices();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  await metrics.listen();

  console.log(`Notifications service running on port ${port}`);
}

bootstrap();
