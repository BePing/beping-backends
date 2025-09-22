import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MemberEntry } from '../../../entity/tabt-soap/TabTAPI_Port';
import { ClubService } from '../../../services/clubs/club.service';
import { ClubTeamService } from '../../../services/clubs/club-team.service';
import { TabtException } from '../../../common/filter/tabt-exceptions.filter';
import { TabtHeadersDecorator } from '../../../common/decorators/tabt-headers.decorator';
import { GetMembersFromClub, ListAllClubs } from '../dto/club.dto';
import { RequestBySeasonDto } from '../../../common/dto/request-by-season.dto';
import {
  MatchesMembersRankerService,
  PlayerMatchStats,
} from '../../../services/matches/matches-members-ranker.service';
import { MemberService } from '../../../services/members/member.service';
import { ClubDto } from '../dto/club-model.dto';
import { MemberEntryDTOV1 } from '../../member/dto/member.dto';
import { mapClubCategoryDTOToClubCategory } from '../../../common/dto/club-category.dto';
import { TeamDto } from '../dto/team-model.dto';

@ApiTags('Clubs')
@Controller({
  path: 'clubs',
  version: '1',
})
@TabtHeadersDecorator()
export class ClubController {
  constructor(
    private clubService: ClubService,
    private clubTeamService: ClubTeamService,
    private memberService: MemberService,
    private matchesMembersRankerService: MatchesMembersRankerService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'findAllClubs',
  })
  @ApiResponse({
    description: 'A list of clubs.',
    type: [ClubDto],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  async findAll(@Query() input: ListAllClubs) {
    const clubs = await this.clubService.getClubs({
      ClubCategory: mapClubCategoryDTOToClubCategory(input.clubCategory),
    });
    return clubs.map(ClubDto.fromTabT);
  }

  @Get(':clubIndex')
  @ApiOperation({
    operationId: 'findClubById',
  })
  @ApiResponse({
    description: 'A specific club based on the uniqueIndex.',
    type: ClubDto,
    status: 200,
  })
  @ApiNotFoundResponse()
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  async findbyId(@Param('clubIndex') uniqueIndex: string) {
    const club = await this.clubService.getClubById(uniqueIndex);
    if (!club) {
      throw new NotFoundException();
    }
    return ClubDto.fromTabT(club);
  }

  @Get(':clubIndex/members')
  @ApiOperation({
    operationId: 'findClubMembers',
  })
  @ApiResponse({
    description: 'A list of members from a specific club.',
    type: [MemberEntryDTOV1],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  async getClubMembers(
    @Query() input: GetMembersFromClub,
    @Param('clubIndex') uniqueIndex: string,
  ) {
    const members = await this.memberService.getMembersV1({
      club: uniqueIndex,
      playerCategory: input.playerCategory,
      uniqueIndex: input.uniqueIndex,
      nameSearch: input.nameSearch,
      extendedInformation: input.extendedInformation,
      rankingPointsInformation: input.rankingPointsInformation,
      withResults: input.withResults,
      withOpponentRankingEvaluation: input.withOpponentRankingEvaluation,
    });
    return members.map(MemberEntryDTOV1.fromTabT);
  }

  @Get(':clubIndex/teams')
  @ApiOperation({
    operationId: 'findClubTeams',
  })
  @ApiResponse({
    description: 'A list of teams from a specific club.',
    type: [TeamDto],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  async getClubTeams(
    @Query() input: RequestBySeasonDto,
    @Param('clubIndex') uniqueIndex: string,
  ) {
    const teams = await this.clubTeamService.getClubsTeams({
      Club: uniqueIndex,
    });
    return teams.map(TeamDto.fromTabT);
  }

  @Get(':clubIndex/teams/:teamId/ranking')
  @ApiOperation({
    operationId: 'findClubTeamsMemberRanking',
  })
  @ApiResponse({
    description: 'A ranking of all players from a team.',
    type: [PlayerMatchStats],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  getClubTeamsMembersRanking(
    @Query() input: RequestBySeasonDto,
    @Param('clubIndex') clubIndex: string,
    @Param('teamId') teamId: string,
  ) {
    return this.matchesMembersRankerService.getMembersRankingFromTeam(
      clubIndex,
      teamId,
      input.season,
    );
  }

  @Get(':clubIndex/members/ranking')
  @ApiOperation({
    operationId: 'findMembersRanking',
  })
  @ApiResponse({
    description: 'A ranking of members playing in a given division.',
    type: [PlayerMatchStats],
    status: 200,
  })
  @ApiResponse({
    status: 400,
    type: TabtException,
  })
  async findClubMembersRanking(
    @Param('clubIndex') id: string,
    @Query() query: RequestBySeasonDto,
  ): Promise<PlayerMatchStats[]> {
    return this.matchesMembersRankerService.getMembersRankingFromClub(
      id,
      query.season,
    );
  }
}
