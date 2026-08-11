import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PostHogService, PrismaService } from '@app/common';
import { ChallengeCalculatorService } from './challenge-calculator.service';
import { ChallengeConfigValidatorService } from './challenge-config-validator.service';
import { ChallengeOrchestratorService } from './challenge-orchestrator.service';
import { ChallengePressService } from './challenge-press.service';
import { ChallengeConfigImporterService } from './challenge-config-importer.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    PrismaService,
    PostHogService,
    ChallengeCalculatorService,
    ChallengeConfigValidatorService,
    ChallengeOrchestratorService,
    ChallengePressService,
    ChallengeConfigImporterService,
  ],
})
export class ChallengeWorkerModule {}
