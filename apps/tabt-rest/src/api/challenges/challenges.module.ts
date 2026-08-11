import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import {
  ChallengeController,
  MemberChallengeRankingsController,
} from './challenge.controller';
import { ChallengeService } from './challenge.service';

@Module({
  imports: [CommonModule],
  controllers: [ChallengeController, MemberChallengeRankingsController],
  providers: [ChallengeService],
  exports: [ChallengeService],
})
export class ChallengesModule {}
