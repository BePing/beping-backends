import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  GetPlayerCategoriesInput,
  MemberEntry,
  PlayerCategoryEntries,
} from '../../../entity/tabt-soap/TabTAPI_Port';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MemberService } from '../../../services/members/member.service';
import { TabtHeadersDecorator } from '../../../common/decorators/tabt-headers.decorator';
import {
  GetMembersV1,
  GetMemberV1,
  GetPlayerCategoriesInputV1,
  MemberEntryDTOV1,
  PlayerCategoryEntriesDTOV1,
  WeeklyNumericPointsInputV1,
  WeeklyNumericPointsV1,
} from '../dto/member.dto';
import { SeasonService } from '../../../services/seasons/season.service';
import { MemberCategoryService } from '../../../services/members/member-category.service';
import {
  NumericRankingService,
  WeeklyRankingV1Response,
} from '../../../services/members/numeric-ranking.service';

@ApiTags('Members')
@Controller({
  path: 'members',
  version: '1',
})
export class MemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly memberCategoryService: MemberCategoryService,
    private readonly numericRankingService: NumericRankingService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'findAllMembersV1',
  })
  @ApiOkResponse({
    type: [MemberEntryDTOV1],
    description: 'List of players found with specific search criterias',
  })
  @TabtHeadersDecorator()
  async findAll(@Query() input: GetMembersV1): Promise<MemberEntryDTOV1[]> {
    const members = await this.memberService.getMembersV1(input);
    if (members.length === 0) {
      throw new NotFoundException('No members found');
    }
    return members.map(MemberEntryDTOV1.fromTabT);
  }

  @Get('categories')
  @ApiOkResponse({
    type: MemberEntryDTOV1,
    description: 'The categories of a specific player',
  })
  @ApiOperation({
    operationId: 'findMemberCategoriesV1',
  })
  @ApiNotFoundResponse()
  @TabtHeadersDecorator()
  @UseInterceptors(ClassSerializerInterceptor)
  async findMemberCategoriesById(
    @Query() input: GetPlayerCategoriesInputV1,
  ): Promise<PlayerCategoryEntriesDTOV1[]> {
    const categories = await this.memberCategoryService.getMembersCategories({
      UniqueIndex: input.uniqueIndex,
      ShortNameSearch: input.shortNameSearch,
      RankingCategory: input.rankingCategory,
    });
    return categories.map(PlayerCategoryEntriesDTOV1.fromTabT);
  }

  @Get(':uniqueIndex')
  @ApiOkResponse({
    type: MemberEntryDTOV1,
    description: 'The information of a specific player',
  })
  @ApiOperation({
    operationId: 'findMemberByIdV1',
  })
  @ApiNotFoundResponse()
  @TabtHeadersDecorator()
  @UseInterceptors(ClassSerializerInterceptor)
  async findById(
    @Query() input: GetMemberV1,
    @Param('uniqueIndex', ParseIntPipe) id: number,
  ): Promise<MemberEntryDTOV1> {
    const members = await this.memberService.getMembersV1({
      ...input,
      uniqueIndex: id,
    });
    if (members.length === 1) {
      return members[0];
    }
    throw new NotFoundException();
  }

  @Get(':uniqueIndex/numeric-rankings')
  @ApiOkResponse({
    type: WeeklyNumericPointsV1,
    description: 'The list of ELO points for a player in a season',
  })
  @ApiOperation({
    operationId: 'findMemberNumericRankingsHistoryV1',
  })
  @ApiNotFoundResponse({
    description: 'No points found for given player',
  })
  async findNumericRanking(
    @Param('uniqueIndex', ParseIntPipe) id: number,
    @Query() params: WeeklyNumericPointsInputV1,
  ): Promise<WeeklyRankingV1Response> {
    return await this.numericRankingService.getWeeklyRankingV1(
      id,
      params.category,
    );
  }
}
