import { Module } from '@nestjs/common';
import { MemberController } from './controllers/member.controller';
import { MemberService } from '../../services/members/member.service';
import { MemberRankingController } from './controllers/member-ranking.controller';
import { RankingDistributionService } from '../../services/members/ranking-distribution.service';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheModuleOptsFactory } from '@app/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { ServicesModule } from '../../services/services.module';

@Module({
  imports: [
    CommonModule,
    ServicesModule,
    CacheModule.registerAsync({
      useClass: CacheModuleOptsFactory,
      imports: [ConfigModule],
    }),
  ],
  controllers: [MemberController, MemberRankingController],
  providers: [MemberService, RankingDistributionService],
  exports: [MemberService, RankingDistributionService],
})
export class MemberModule {}
