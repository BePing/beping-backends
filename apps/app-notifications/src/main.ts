import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // Create HTTP application for external API access
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe());

  // Connect microservice for internal communication
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT || 3002;
  await app.listen(port);

  console.log(`Notifications service running on port ${port}`);
}

bootstrap();
