import { Injectable, Logger } from '@nestjs/common';
import { ClubMemberService } from '../services/clubs/club-member.service';
import { ClubTeamService } from '../services/clubs/club-team.service';
import { MatchService } from '../services/matches/match.service';
import {
  MemberEntry,
  TeamEntry,
  TeamMatchesEntry,
} from '../entity/tabt-soap/TabTAPI_Port';
import {
  LineupCategory,
  RosterPlayer,
  TeamContext,
} from './lineup/rules/rule.types';

/**
 * Derives federation force-list data (roster + team context) from TabT on the
 * fly. Nothing here is persisted; Lineup.forceSnapshot captures a point-in-time
 * copy at validation for audit.
 */
@Injectable()
export class CaptainRosterService {
  private readonly logger = new Logger(CaptainRosterService.name);

  constructor(
    private readonly clubMemberService: ClubMemberService,
    private readonly clubTeamService: ClubTeamService,
    private readonly matchService: MatchService,
  ) {}

  private toRosterPlayer(m: MemberEntry): RosterPlayer {
    return {
      uniqueIndex: m.UniqueIndex,
      firstName: m.FirstName,
      lastName: m.LastName,
      ranking: m.Ranking,
      rankingIndex: m.RankingIndex,
      position: m.Position,
      gender: m.Gender,
    };
  }

  async getClubMembers(clubIndex: string): Promise<MemberEntry[]> {
    return this.clubMemberService.getClubsMembers({ Club: clubIndex });
  }

  /** Whole club force list for a category, keyed by uniqueIndex. */
  async buildRoster(
    clubIndex: string,
    category: LineupCategory,
  ): Promise<Map<number, RosterPlayer>> {
    const members = await this.getClubMembers(clubIndex);
    const filtered = members.filter((m) => {
      if (category === LineupCategory.WOMEN) {
        return m.Gender === 'F';
      }
      return m.Gender !== 'F';
    });
    return new Map(
      filtered
        .map((m) => this.toRosterPlayer(m))
        .map((p) => [p.uniqueIndex, p] as const),
    );
  }

  async rosterForUniqueIndexes(
    clubIndex: string,
    uniqueIndexes: number[],
  ): Promise<Map<number, RosterPlayer>> {
    const members = await this.getClubMembers(clubIndex);
    const wanted = new Set(uniqueIndexes);
    return new Map(
      members
        .filter((m) => wanted.has(m.UniqueIndex))
        .map((m) => this.toRosterPlayer(m))
        .map((p) => [p.uniqueIndex, p] as const),
    );
  }

  async getClubTeams(clubIndex: string): Promise<TeamEntry[]> {
    return this.clubTeamService.getClubsTeams({ Club: clubIndex });
  }

  async getMatch(matchUniqueId: number): Promise<TeamMatchesEntry | null> {
    const matches = await this.matchService.getMatches({
      MatchUniqueId: matchUniqueId,
      WithDetails: true,
    });
    return matches[0] ?? null;
  }

  /** All matches of a club this season. */
  async getClubMatches(clubIndex: string): Promise<TeamMatchesEntry[]> {
    return this.matchService.getMatches({ Club: clubIndex });
  }

  /** matchUniqueId -> interclubs week name, for a club's whole season. */
  async clubMatchWeeks(clubIndex: string): Promise<Map<number, string>> {
    const matches = await this.getClubMatches(clubIndex);
    return new Map(
      matches
        .filter((m) => m.MatchUniqueId != null)
        .map((m) => [m.MatchUniqueId, m.WeekName] as const),
    );
  }

  /** teamId -> { teamRankInClub, category } for the club's teams. */
  async teamMeta(
    clubIndex: string,
  ): Promise<
    Map<string, { teamRankInClub: number; category: LineupCategory }>
  > {
    const teams = await this.getClubTeams(clubIndex);
    return new Map(
      teams.map((t) => {
        const letter = CaptainRosterService.teamLetter(t);
        return [
          t.TeamId,
          {
            teamRankInClub: letter.charCodeAt(0) - 64,
            category: CaptainRosterService.categoryOf(t),
          },
        ] as const;
      }),
    );
  }

  /** Extracts the trailing team letter (A, B, C…) from a team label. */
  static teamLetter(team: TeamEntry): string {
    const match = /([A-Z])\s*$/.exec(team.Team ?? '');
    return match ? match[1] : 'A';
  }

  static categoryOf(team: TeamEntry): LineupCategory {
    const name = (team.DivisionName ?? '').toLowerCase();
    if (team.DivisionCategory === 38 || /dame|women|female/.test(name)) {
      return LineupCategory.WOMEN;
    }
    if (/vétéran|veteran/.test(name)) {
      return LineupCategory.VETERANS;
    }
    return LineupCategory.MEN;
  }

  static teamSizeOf(category: LineupCategory): number {
    return category === LineupCategory.MEN ? 4 : 3;
  }

  async resolveTeamContext(
    clubIndex: string,
    teamId: string,
  ): Promise<TeamContext | null> {
    const teams = await this.getClubTeams(clubIndex);
    const team = teams.find((t) => t.TeamId === teamId);
    if (!team) {
      this.logger.warn(`Team ${teamId} not found in club ${clubIndex}`);
      return null;
    }
    const letter = CaptainRosterService.teamLetter(team);
    const category = CaptainRosterService.categoryOf(team);
    return {
      teamId: team.TeamId,
      teamLetter: letter,
      teamRankInClub: letter.charCodeAt(0) - 64, // A=1, B=2…
      teamSize: CaptainRosterService.teamSizeOf(category),
      category,
      divisionId: team.DivisionId,
    };
  }
}
