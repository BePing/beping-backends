import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  getApps,
  initializeApp,
  cert,
  ServiceAccount,
} from 'firebase-admin/app';
import { MessagingFirebaseService } from './messaging-firebase.service';

@Module({
  imports: [ConfigModule],
  providers: [
    MessagingFirebaseService,
    {
      provide: 'FIREBASE_INIT',
      useFactory: (configService: ConfigService) => {
        if (!getApps().length) {
          const adminConfig: ServiceAccount = {
            projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
            privateKey: configService
              .get<string>('FIREBASE_PRIVATE_KEY')
              ?.replace(/\\n/g, '\n'),
            clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
          };
          // Initialize the firebase admin app
          if (
            adminConfig.projectId &&
            adminConfig.privateKey &&
            adminConfig.clientEmail
          ) {
            initializeApp({
              credential: cert(adminConfig),
            });
          }
        }
        return true;
      },
      inject: [ConfigService],
    },
  ],
  exports: [MessagingFirebaseService],
})
export class FirebaseModule {}
