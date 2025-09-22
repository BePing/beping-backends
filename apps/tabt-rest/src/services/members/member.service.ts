import { Injectable, Logger } from '@nestjs/common';
import {
  GetMembersInput,
  MemberEntry,
} from '../../entity/tabt-soap/TabTAPI_Port';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import { ContextService } from '../../common/context/context.service';
import { HeaderKeys } from '../../common/context/context.constants';
import { PlayerCategory } from '../../entity/tabt-input.interface';
import { GetMembersV1 } from '../../api/member/dto/member.dto';
import {
  mapPlayerCategoryDTOToPlayerCategory,
  mapPlayerCategoryToPlayerCategoryDTO,
  PlayerCategoryDTO,
} from '../../common/dto/player-category.dto';

@Injectable()
export class MemberService {
  private readonly logger = new Logger('MemberService');

  constructor(
    private tabtClient: TabtClientService,
    private contextService: ContextService,
  ) {}

  async getMembersV1(query: GetMembersV1): Promise<MemberEntry[]> {
    const result = await this.tabtClient.GetMembersAsync({
      Club: query.club,
      PlayerCategory: mapPlayerCategoryDTOToPlayerCategory(
        query.playerCategory,
      ),
      UniqueIndex: query.uniqueIndex,
      NameSearch: query.nameSearch,
      ExtendedInformation: query.extendedInformation,
      RankingPointsInformation: query.rankingPointsInformation,
      WithResults: query.withResults,
      WithOpponentRankingEvaluation: query.withOpponentRankingEvaluation,
    });
    return result.MemberEntries ?? [];
  }
}
