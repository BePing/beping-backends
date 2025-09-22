import { Module } from '@nestjs/common';
import { MemberDashboardController } from './controllers/member-dashboard.controller';
import { MemberDashboardService } from './services/member-dashboard.service';
import { MatchService } from '../../services/matches/match.service';
import { CacheService } from '../../common/cache/cache.service';
import { MemberService } from '../../services/members/member.service';
import { NumericRankingService } from '../../services/members/numeric-ranking.service';
import { MatchesMembersRankerService } from '../../services/matches/matches-members-ranker.service';
import { PointsEstimationService } from '../../services/members/points-estimation.service';
import { CommonModule } from '../../common/common.module';
import { ServicesModule } from '../../services/services.module';
import { PrismaService } from '../../common/prisma.service';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { ConfigService } from '@nestjs/config';
import { ContextService } from '../../common/context/context.service';
import { RankingDistributionService } from '../../services/members/ranking-distribution.service';
import { CacheModule } from '@nestjs/cache-manager';
import { DivisionDashboardService } from './services/division-dashboard.service';
import { ClubDashboardService } from './services/club-dashboard.service';

@Module({
  imports: [CommonModule, ServicesModule],
  controllers: [MemberDashboardController],
  providers: [
    MemberDashboardService,
    ClubDashboardService,
    DivisionDashboardService,
  ],
})
export class DashboardModule {}
