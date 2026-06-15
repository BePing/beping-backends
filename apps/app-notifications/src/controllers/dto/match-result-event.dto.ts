import { IsString } from 'class-validator';

export class MatchResultEventDto {
  @IsString()
  matchId: string;
}
