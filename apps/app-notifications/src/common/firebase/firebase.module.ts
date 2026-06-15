import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { MessagingFirebaseService } from './messaging-firebase.service';

@Module({
  imports: [ConfigModule],
  providers: [
    MessagingFirebaseService,
    {
      provide: 'FIREBASE_INIT',
      useFactory: (configService: ConfigService) => {
        if (!admin.apps.length) {
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
            admin.initializeApp({
              credential: admin.credential.cert(adminConfig),
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
