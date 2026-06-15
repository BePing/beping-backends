import { Module } from '@nestjs/common';
import { MemberDashboardController } from './controllers/member-dashboard.controller';
import { MemberDashboardService } from './services/member-dashboard.service';
import { CommonModule } from '../../common/common.module';
import { ServicesModule } from '../../services/services.module';
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
