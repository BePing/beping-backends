import { Injectable } from '@nestjs/common';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';
import {
  GetPlayerCategoriesInput,
  PlayerCategoryEntries,
} from '../../entity/tabt-soap/TabTAPI_Port';

@Injectable()
export class MemberCategoryService {
  constructor(private readonly tabtClient: TabtClientService) {}

  async getMembersCategories(
    input: GetPlayerCategoriesInput,
  ): Promise<PlayerCategoryEntries[]> {
    const { PlayerCategoryEntries, PlayerCategoryCount } =
      await this.tabtClient.GetMembersCategoriesAsync(input);
    if (PlayerCategoryCount === 0) {
      return [];
    }
    return PlayerCategoryEntries;
  }
}
