import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineupStatus } from '@app/common';

export class HubNextMatchDto {
  @ApiProperty()
  matchUniqueId: number;

  @ApiProperty()
  opponent: string;

  @ApiProperty()
  date: string;

  @ApiProperty()
  time: string;

  @ApiProperty()
  home: boolean;

  @ApiPropertyOptional()
  venue?: string;

  @ApiProperty()
  weekName: string;
}

export class HubAvailabilitySummaryDto {
  @ApiProperty()
  present: number;

  @ApiProperty()
  absent: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  total: number;
}

export class HubPrepDto {
  @ApiPropertyOptional({ type: HubAvailabilitySummaryDto })
  availability?: HubAvailabilitySummaryDto;

  @ApiProperty({ enum: LineupStatus })
  lineupStatus: LineupStatus;

  @ApiProperty()
  convocationSent: boolean;
}

export class CaptainTeamDto {
  @ApiProperty()
  teamId: string;

  @ApiProperty()
  teamLabel: string;

  @ApiProperty()
  divisionId: number;

  @ApiProperty()
  divisionName: string;

  @ApiProperty()
  clubIndex: string;

  @ApiPropertyOptional({ type: HubNextMatchDto })
  nextMatch?: HubNextMatchDto;

  @ApiPropertyOptional({ type: HubPrepDto })
  prep?: HubPrepDto;
}

export class CaptainHubDto {
  @ApiProperty({ type: [CaptainTeamDto] })
  teams: CaptainTeamDto[];
}
