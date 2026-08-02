import { Injectable } from '@nestjs/common';
import {
  GetClubTeamsInput,
  TeamEntry,
} from '../../entity/tabt-soap/TabTAPI_Port';
import { TabtClientService } from '../../common/tabt-client/tabt-client.service';

@Injectable()
export class ClubTeamService {
  constructor(private tabtClient: TabtClientService) {}

  async getClubsTeams(input: GetClubTeamsInput): Promise<TeamEntry[]> {
    const result = await this.tabtClient.GetClubTeamsAsync(input);
    // TabT omits TeamEntries when the club has no teams (yet) this season.
    return result.TeamEntries ?? [];
  }
}
