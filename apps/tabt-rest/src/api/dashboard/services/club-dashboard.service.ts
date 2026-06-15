import { Injectable } from '@nestjs/common';
import { ClubService } from '../../../services/clubs/club.service';
import { DashboardServiceInterface } from '../interfaces/dashboard-service.interface';
import { DivisionMemberDashboardDTOV1 } from '../dto/division-dashboard.dto';
import { MatchesMembersRankerService } from '../../../services/matches/matches-members-ranker.service';
import { DivisionMemberDashboardDTOV1Mapper } from '../dto/mappers/division-member-dashboard-dto-v1.mapper';
import { ClubDashboardDTOV1 } from '../dto/club-dashboard.dto';
import { MemberService } from '../../../services/members/member.service';
import { MatchService } from '../../../services/matches/match.service';
import { ClubTeamService } from '../../../services/clubs/club-team.service';
import {
  ClubEntry,
  MemberEntry,
  TeamEntry,
  TeamMatchesEntry,
} from '../../../entity/tabt-soap/TabTAPI_Port';
import { RESPONSE_STATUS, ResponseDTO } from '../dto/common.dto';
import { PlayerCategoryDTO } from '../../../common/dto/player-category.dto';

@Injectable()
export class ClubDashboardService
  implements DashboardServiceInterface<ClubDashboardDTOV1>
{
  constructor(
    private readonly clubService: ClubService,
    private readonly matchesMembersRankerService: MatchesMembersRankerService,
    private readonly memberService: MemberService,
    private readonly matchService: MatchService,
    private readonly clubTeamService: ClubTeamService,
  ) {}

  async getDashboard(clubUniqueIndex: string): Promise<ClubDashboardDTOV1> {
    try {
      const club = await this.getClub(clubUniqueIndex);

      const [men, women, teams, matches] = await Promise.all([
        this.getClubMembers(
          clubUniqueIndex,
          PlayerCategoryDTO.SENIOR_MEN,
        ).catch(() => null),
        this.getClubMembers(
          clubUniqueIndex,
          PlayerCategoryDTO.SENIOR_WOMEN,
        ).catch(() => null),
        this.getClubTeams(clubUniqueIndex).catch(() => null),
        this.getClubMatchesGrouped(clubUniqueIndex).catch(() => null),
      ]);

      return {
        status: ResponseDTO.success('Retrieved club dashboard successfully'),
        club,
        listOfStrength: {
          men,
          women,
        },
        teams,
        matches,
      };
    } catch (error) {
      return {
        status: ResponseDTO.error(error.message),
      };
    }
  }

  async getPlayersStats(
    divisionId: number,
  ): Promise<DivisionMemberDashboardDTOV1[]> {
    const results =
      await this.matchesMembersRankerService.getMembersRankingFromDivision(
        divisionId,
      );
    // map the results to the DTO
    return results.map(DivisionMemberDashboardDTOV1Mapper.mapMemberResults);
  }

  private async getClubsMembers(
    clubUniqueIndex: string,
  ): Promise<ResponseDTO<MemberEntry[]>> {
    try {
      const members = await this.memberService.getMembersV1({
        club: clubUniqueIndex,
      });
      return new ResponseDTO(RESPONSE_STATUS.SUCCESS, members);
    } catch (error) {
      return new ResponseDTO(RESPONSE_STATUS.ERROR, undefined, error.message);
    }
  }

  private async getClub(clubUniqueIndex: string): Promise<ClubEntry | null> {
    try {
      const clubs = await this.clubService.getClubs({ Club: clubUniqueIndex });
      if (!clubs?.[0]) {
        return null;
      }
      return clubs[0];
    } catch (error) {
      throw new Error(error.message);
    }
  }

  private async getClubMembers(
    clubUniqueIndex: string,
    category?: PlayerCategoryDTO,
  ): Promise<MemberEntry[]> {
    try {
      const members = await this.memberService.getMembersV1({
        club: clubUniqueIndex,
        playerCategory: category,
      });
      return members;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  private async getClubTeams(clubUniqueIndex: string): Promise<TeamEntry[]> {
    try {
      const teams = await this.clubTeamService.getClubsTeams({
        Club: clubUniqueIndex,
      });
      return teams;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  private async getClubMatchesGrouped(
    clubUniqueIndex: string,
  ): Promise<TeamMatchesEntry[]> {
    try {
      const matches = await this.matchService.getMatches({
        Club: clubUniqueIndex,
      });

      return matches;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
