import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../common/common.module';
import { ServicesModule } from '../services/services.module';

import { CaptainAuthController } from './auth/captain-auth.controller';
import { CaptainAuthService } from './auth/captain-auth.service';
import { CaptainTokenService } from './auth/captain-token.service';
import { CaptainJwtGuard } from './auth/captain-jwt.guard';
import { CaptainProGuard } from './auth/captain-pro.guard';

import { CaptainRosterService } from './captain-roster.service';
import { CaptainNotifierService } from './notifications/captain-notifier.service';

import { CaptainHubController } from './hub/captain-hub.controller';
import { CaptainHubService } from './hub/captain-hub.service';

import { CaptainAvailabilityController } from './availability/captain-availability.controller';
import { CaptainAvailabilityService } from './availability/captain-availability.service';

import { CaptainLineupController } from './lineup/captain-lineup.controller';
import { CaptainLineupService } from './lineup/captain-lineup.service';
import { RuleSetResolver } from './lineup/rules/rule-set.resolver';

import { CaptainIntelligenceService } from './intelligence/captain-intelligence.service';

import { CaptainConvocationController } from './convocation/captain-convocation.controller';
import { ConvocationPublicController } from './convocation/convocation-public.controller';
import { CaptainConvocationService } from './convocation/captain-convocation.service';

@Module({
  imports: [
    CommonModule,
    ServicesModule,
    HttpModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [
    CaptainAuthController,
    CaptainHubController,
    CaptainAvailabilityController,
    CaptainLineupController,
    CaptainConvocationController,
    ConvocationPublicController,
  ],
  providers: [
    CaptainAuthService,
    CaptainTokenService,
    CaptainJwtGuard,
    CaptainProGuard,
    CaptainRosterService,
    CaptainNotifierService,
    CaptainHubService,
    CaptainAvailabilityService,
    CaptainLineupService,
    RuleSetResolver,
    CaptainIntelligenceService,
    CaptainConvocationService,
  ],
})
export class CaptainModule {}
