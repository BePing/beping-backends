import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MemberEntry,
  MemberEntryResultEntry,
  TeamMatchesEntry,
} from '../../../entity/tabt-soap/TabTAPI_Port';
import { ResponseDTO } from './common.dto';
import { WeeklyRankingV1Response } from 'apps/tabt-rest/src/services/members/numeric-ranking.service';

export class WinLossSummaryDTOV1 {
  @ApiProperty({ type: Number })
  count: number;

  @ApiPropertyOptional({ type: Number })
  victories?: number;

  @ApiPropertyOptional({ type: Number })
  defeats?: number;

  @ApiPropertyOptional({ type: Number })
  victoriesPct?: number;

  @ApiPropertyOptional({ type: Number })
  defeatsPct?: number;
}

export class RankingWinLossDTOV1 extends WinLossSummaryDTOV1 {
  @ApiProperty()
  ranking: string;

  @ApiProperty({ type: MemberEntryResultEntry, isArray: true })
  players: MemberEntryResultEntry[];
}

export class WeeklyNumericRankingInputV2 {
  @ApiProperty({ required: false, description: 'Team ID to get next match estimation points' })
  teamId?: string;
}

export class SetStatsDTOV1 {
  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty({ type: Number })
  won: number;

  @ApiProperty({ type: Number })
  lost: number;

  @ApiProperty({ type: Number })
  wonPct: number;

  @ApiProperty({ type: Number })
  lostPct: number;
}

export class StreakDTOV1 {
  @ApiProperty({ type: Number })
  current: number;

  @ApiProperty({ type: Number })
  best: number;

  @ApiProperty({ type: Number })
  worst: number;
}

export class SeasonExtremesDTOV1 {
  @ApiProperty({ type: String })
  highestRanking: string;

  @ApiProperty({ type: String })
  lowestRanking: string;

  @ApiProperty({ type: Number, required: false })
  highestPoints?: number;

  @ApiProperty({ type: Number, required: false })
  lowestPoints?: number;

  @ApiProperty({ type: String })
  firstMatch: string;

  @ApiProperty({ type: String })
  lastMatch: string;
}

export class MatchHistoryEntryDTOV1 {
  @ApiProperty({ type: String })
  date: string;

  @ApiProperty({ enum: ['V', 'D'] })
  result: 'V' | 'D';

  @ApiProperty({ type: String })
  opponentName: string;

  @ApiProperty({ type: String })
  opponentRanking: string;

  @ApiProperty({ type: String })
  score: string;
}

export class TimeOfDayStatsDTOV1 extends WinLossSummaryDTOV1 {
  @ApiProperty({ enum: ['morning', 'afternoon', 'evening'] })
  timeSlot: 'morning' | 'afternoon' | 'evening';
}

export class DayOfWeekStatsDTOV1 extends WinLossSummaryDTOV1 {
  @ApiProperty({ type: String })
  day: string;
}

export class MonthlyStatsDTOV1 extends WinLossSummaryDTOV1 {
  @ApiProperty({ type: String })
  month: string;
}

export class MatchDetailsDTOV1 {
  @ApiProperty({ type: Number })
  averageSetsPerMatch: number;

  @ApiProperty({ type: Number })
  cleanVictories: number;

  @ApiProperty({ type: Number })
  cleanDefeats: number;

  @ApiProperty({ type: Number })
  comebacks: number;

  @ApiProperty({ type: Number })
  leadLost: number;
}

export class MemberStatsDTOV1 {
  @ApiProperty({ type: () => WinLossSummaryDTOV1 })
  tieBreaks: WinLossSummaryDTOV1;

  @ApiProperty({ type: () => WinLossSummaryDTOV1 })
  matches: WinLossSummaryDTOV1;

  @ApiProperty({ type: () => RankingWinLossDTOV1, isArray: true })
  perRanking: RankingWinLossDTOV1[];

  @ApiProperty({ type: () => SetStatsDTOV1 })
  sets: SetStatsDTOV1;

  @ApiProperty({ type: () => StreakDTOV1 })
  winStreak: StreakDTOV1;

  @ApiProperty({ type: () => StreakDTOV1 })
  lossStreak: StreakDTOV1;

  @ApiProperty({ type: () => SeasonExtremesDTOV1 })
  seasonExtremes: SeasonExtremesDTOV1;

  @ApiProperty({ type: () => MatchHistoryEntryDTOV1, isArray: true })
  matchHistory: MatchHistoryEntryDTOV1[];

  @ApiProperty({ type: () => TimeOfDayStatsDTOV1, isArray: true })
  timeOfDay: TimeOfDayStatsDTOV1[];

  @ApiProperty({ type: () => DayOfWeekStatsDTOV1, isArray: true })
  dayOfWeek: DayOfWeekStatsDTOV1[];

  @ApiProperty({ type: () => MonthlyStatsDTOV1, isArray: true })
  monthly: MonthlyStatsDTOV1[];

  @ApiProperty({ type: () => MatchDetailsDTOV1 })
  matchDetails: MatchDetailsDTOV1;
}

export class OpponentEstimationDTO {
  @ApiProperty({ type: String })
  firstName: string;

  @ApiProperty({ type: String })
  lastName: string;

  @ApiProperty({ type: String })
  ranking: string;

  @ApiProperty({ type: Number })
  pointsToWin: number;

  @ApiProperty({ type: Number })
  coefficient: number;

  @ApiProperty({ type: Boolean })
  isExpectedWin: boolean;

  @ApiProperty({ type: Number })
  pointsDifference: number;
}

export class NextMatchEstimationDTO {
  @ApiPropertyOptional({ type: String })
  matchId?: string;

  @ApiPropertyOptional({ type: String })
  date?: string;

  @ApiPropertyOptional({ type: String })
  homeTeam: string;

  @ApiPropertyOptional({ type: String })
  awayTeam?: string;

  @ApiProperty({ type: () => OpponentEstimationDTO, isArray: true, description: 'Best case scenario - most points to win' })
  bestCase: OpponentEstimationDTO[];

  @ApiProperty({ type: () => OpponentEstimationDTO, isArray: true, description: 'Worst case scenario - least points to win' })
  worstCase: OpponentEstimationDTO[];
}

export class MemberDashboardDTOV1 {
  @ApiProperty({
    type: () => ResponseDTO,
    description: 'The status of the response',
  })
  public status: ResponseDTO<string>;

  @ApiProperty({ type: () => MemberEntry, description: 'The member data' })
  public member: MemberEntry;

  @ApiProperty({
    type: () => WeeklyRankingV1Response,
    description: 'The numeric ranking response',
  })
  public numericRanking: WeeklyRankingV1Response;

  @ApiProperty({
    type: () => TeamMatchesEntry,
    isArray: true,
    description: 'The latest team matches',
  })
  public latestTeamMatches: TeamMatchesEntry[];

  @ApiProperty({
    type: () => MemberStatsDTOV1,
    description: 'The statistics of the member',
  })
  public stats: MemberStatsDTOV1;

  @ApiProperty({ type: () => NextMatchEstimationDTO, required: false })
  public nextMatchEstimation?: NextMatchEstimationDTO;

  constructor(status: ResponseDTO<string>) {
    this.status = status;
  }
}

export class RankingDistributionEntryDTOV1 {
  @ApiProperty({ type: String })
  ranking: string;

  @ApiProperty({ type: Number })
  count: number;

  @ApiProperty({ type: Number })
  percentage: number;
}

export class RankingDistributionDTOV1 {
  @ApiProperty({ type: Number })
  totalPlayers: number;

  @ApiProperty({ type: () => RankingDistributionEntryDTOV1, isArray: true })
  distribution: RankingDistributionEntryDTOV1[];
}

export class MultiCategoryMemberDashboardDTOV1 {
  @ApiProperty({
    type: () => ResponseDTO,
    description: 'The status of the response',
  })
  public status: ResponseDTO<string>;

  @ApiProperty({
    type: () => MemberDashboardDTOV1,
    required: false,
    description: 'Dashboard data for SENIOR_MEN category'
  })
  public SENIOR_MEN?: MemberDashboardDTOV1;

  @ApiProperty({
    type: () => MemberDashboardDTOV1,
    required: false,
    description: 'Dashboard data for SENIOR_WOMEN category'
  })
  public SENIOR_WOMEN?: MemberDashboardDTOV1;

  @ApiProperty({
    type: [String],
    description: 'List of categories where the member exists'
  })
  public availableCategories: string[];

  constructor(status: ResponseDTO<string>) {
    this.status = status;
    this.availableCategories = [];
  }
}
