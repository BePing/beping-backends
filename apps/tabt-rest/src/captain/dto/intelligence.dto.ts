import { ApiProperty } from '@nestjs/swagger';
import { LineupSlotInputDto } from './lineup.dto';

export class FaceToFacePlayerDto {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  ranking: string;
}

export class FaceToFaceOpponentDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  ranking: string;
}

export class FaceToFaceDto {
  @ApiProperty()
  position: number;

  @ApiProperty({ type: FaceToFacePlayerDto })
  mine: FaceToFacePlayerDto;

  @ApiProperty({ type: FaceToFaceOpponentDto })
  theirs: FaceToFaceOpponentDto;

  @ApiProperty({ enum: ['ADVANTAGE', 'TIGHT', 'TRAP'] })
  edge: 'ADVANTAGE' | 'TIGHT' | 'TRAP';

  @ApiProperty()
  winProbability: number;
}

export class ReinforcementDto {
  @ApiProperty()
  uniqueIndex: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  ranking: string;

  @ApiProperty()
  rankingIndex: number;

  @ApiProperty()
  fromTeam: string;

  @ApiProperty()
  probabilityGain: number;

  @ApiProperty()
  eligible: boolean;

  @ApiProperty({ required: false })
  blockedBy?: string;
}

export class LineupIntelligenceDto {
  @ApiProperty()
  winProbability: number;

  @ApiProperty()
  probabilityDelta: number;

  @ApiProperty({ type: [LineupSlotInputDto] })
  optimalOrder: LineupSlotInputDto[];

  @ApiProperty({ type: [FaceToFaceDto] })
  faceToFace: FaceToFaceDto[];

  @ApiProperty({ type: [ReinforcementDto] })
  reinforcements: ReinforcementDto[];
}
