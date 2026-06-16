import { Injectable } from '@nestjs/common';
import { DivisionService } from '../../../services/divisions/division.service';
import { ClubService } from '../../../services/clubs/club.service';
import { DashboardServiceInterface } from '../interfaces/dashboard-service.interface';
import { DivisionRankingService } from '../../../services/divisions/division-ranking.service';
import {
  DivisionDashboardDTOV1,
  DivisionMemberDashboardDTOV1,
} from '../dto/division-dashboard.dto';
import { MatchesMembersRankerService } from '../../../services/matches/matches-members-ranker.service';
import { DivisionMemberDashboardDTOV1Mapper } from '../dto/mappers/division-member-dashboard-dto-v1.mapper';
import { RESPONSE_STATUS, ResponseDTO } from '../dto/common.dto';
import {
  DivisionEntry,
  RankingEntry,
} from '../../../entity/tabt-soap/TabTAPI_Port';

@Injectable()
export class DivisionDashboardService implements DashboardServiceInterface<DivisionDashboardDTOV1> {
  constructor(
    private readonly divisionService: DivisionService,
    private readonly divisionRankingService: DivisionRankingService,
    private readonly matchesMembersRankerService: MatchesMembersRankerService,
    private readonly clubService: ClubService,
  ) {}

  async getDashboard(divisionId: number): Promise<DivisionDashboardDTOV1> {
    const division = await this.getDivision(divisionId);
    if (!division.payload) {
      return {
        division: new ResponseDTO(
          RESPONSE_STATUS.ERROR,
          undefined,
          'No division found for given id',
        ),
        ranking: new ResponseDTO(
          RESPONSE_STATUS.ERROR,
          undefined,
          'No division found for given id',
        ),
        playersStats: new ResponseDTO(
          RESPONSE_STATUS.ERROR,
          undefined,
          'No division found for given id',
        ),
      };
    }

    const [ranking, playersStats] = await Promise.all([
      this.getRanking(divisionId),
      this.getPlayersStats(divisionId),
    ]);

    return {
      division,
      ranking,
      playersStats,
    };
  }

  private async getDivision(
    divisionId: number,
  ): Promise<ResponseDTO<DivisionEntry>> {
    try {
      const division = await this.divisionService.getDivisionByIdV1(divisionId);
      if (!division) {
        return new ResponseDTO(
          RESPONSE_STATUS.ERROR,
          undefined,
          'No division found for given id',
        );
      }
      return new ResponseDTO(RESPONSE_STATUS.SUCCESS, division);
    } catch (error) {
      return new ResponseDTO(RESPONSE_STATUS.ERROR, undefined, error.message);
    }
  }

  private async getRanking(
    divisionId: number,
  ): Promise<ResponseDTO<RankingEntry[]>> {
    try {
      const ranking = await this.divisionRankingService.getDivisionRanking({
        DivisionId: divisionId,
      });
      return new ResponseDTO(RESPONSE_STATUS.SUCCESS, ranking);
    } catch (error) {
      return new ResponseDTO(RESPONSE_STATUS.ERROR, undefined, error.message);
    }
  }

  async getPlayersStats(
    divisionId: number,
  ): Promise<ResponseDTO<DivisionMemberDashboardDTOV1[]>> {
    try {
      const results =
        await this.matchesMembersRankerService.getMembersRankingFromDivision(
          divisionId,
        );
      // map the results to the DTO
      const playersStats = results.map(
        DivisionMemberDashboardDTOV1Mapper.mapMemberResults,
      );
      return new ResponseDTO(RESPONSE_STATUS.SUCCESS, playersStats);
    } catch (error) {
      return new ResponseDTO(RESPONSE_STATUS.ERROR, undefined, error.message);
    }
  }
}
