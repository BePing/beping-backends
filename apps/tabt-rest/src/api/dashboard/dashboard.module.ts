import { Module } from '@nestjs/common';
import { MemberDashboardController } from './controllers/member-dashboard.controller';
import { MemberDashboardService } from './services/member-dashboard.service';
import { CommonModule } from '../../common/common.module';
import { ServicesModule } from '../../services/services.module';
import { DivisionDashboardService } from './services/division-dashboard.service';
import { ClubDashboardService } from './services/club-dashboard.service';
import { ChallengesModule } from '../challenges/challenges.module';

@Module({
  imports: [CommonModule, ServicesModule, ChallengesModule],
  controllers: [MemberDashboardController],
  providers: [
    MemberDashboardService,
    ClubDashboardService,
    DivisionDashboardService,
  ],
})
export class DashboardModule {}
