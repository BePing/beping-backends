import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { GetMembersV1 } from '../../member/dto/member.dto';
import { IsOptional, IsString } from 'class-validator';
import { ClubCategoryDTO } from '../../../common/dto/club-category.dto';

export class ListAllClubs {
  @ApiPropertyOptional({ enum: ClubCategoryDTO })
  @IsOptional()
  @IsString()
  clubCategory: ClubCategoryDTO;
}

export class GetMembersFromClub extends OmitType(GetMembersV1, [
  'club',
] as const) {}
