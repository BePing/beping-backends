import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import * as responseTime from 'response-time';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { PackageService } from './common/package/package.service';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    bufferLogs: true,
  });
  // Configure Express v5 query parser to support nested objects and arrays
  app.set('query parser', 'extended');
  app.useLogger(app.get(Logger));

  const packageService = app.get(PackageService);
  app.setGlobalPrefix(process.env.API_PREFIX);

  const options = new DocumentBuilder()
    .setTitle('TabT Rest')
    .setDescription(
      `This api is a bridge to the TabT SOAP API. It contacts TabT and cache results in order to reduce latency for some requests. More documentation will come.<br>
      The data present in the api such as player names, club names, tournaments or match results are not managed by us. This information is made freely available by the Aile Francophone de Tennis de Table and the Vlaamse Tafeltennisliga. We therefore cannot be held responsible for the publication of this information. If changes need to be made, you should contact the responsible entity.
    If you build an application on top of the BePing's api, be sure to do at least one of the following things:    
    <ul><li>If possible, set a X-Application-For header string. Include the name of your application, and a way to contact you in case something would go wrong.<br>
      An example user agent string format is, which could result in the following string: beping/2.0.0 (floca.be; florent@floca.be). The use of a header like this isn’t obligated or enforced, but allows for better communication.</li></ul>
    `,
    )
    .setContact('Florent Cardoen', 'http://floca.be/', 'f.cardoen@me.com')
    .setVersion(packageService.version)
    .setLicense(
      'GNU General Public License v3.0',
      'https://github.com/Fllorent0D/TabT-Rest/blob/main/LICENSE',
    )
    .addTag('Seasons')
    .addTag('Clubs')
    .addTag('Members')
    .addTag('Matches')
    .addTag('Divisions')
    .addTag('Tournaments')
    .addTag('Search')
    .addServer('https://api-v2.beping.be', 'production')
    .addServer('http://localhost:3004', 'development')
    .build();

  app.enableVersioning({
    type: VersioningType.URI,
  });
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('doc', app, document);
  app.use(compression());
  app.use(helmet());
  app.use(responseTime());

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT || 3004);
}

bootstrap();
