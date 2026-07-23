import { Injectable } from '@nestjs/common';
import { AvailabilityStatus, LineupStatus } from '@app/common';
import { PrismaService } from '@app/common';
import { CaptainRosterService } from '../captain-roster.service';
import { CaptainPrincipal } from '../auth/captain-jwt.guard';
import { CaptainHubDto, CaptainTeamDto } from '../dto/hub.dto';
import { TeamMatchesEntry } from '../../entity/tabt-soap/TabTAPI_Port';

@Injectable()
export class CaptainHubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roster: CaptainRosterService,
  ) {}

  async getHub(captain: CaptainPrincipal): Promise<CaptainHubDto> {
    const clubIndex = captain.clubIndex;
    const [teams, matches] = await Promise.all([
      this.roster.getClubTeams(clubIndex),
      this.roster.getClubMatches(clubIndex),
    ]);

    const now = new Date();
    const upcomingByDivision = new Map<number, TeamMatchesEntry>();
    for (const m of matches) {
      const when = this.matchDate(m);
      if (!when || when < now) {
        continue;
      }
      const current = upcomingByDivision.get(m.DivisionId);
      if (!current || this.matchDate(current)! > when) {
        upcomingByDivision.set(m.DivisionId, m);
      }
    }

    const matchIds = Array.from(upcomingByDivision.values())
      .map((m) => m.MatchUniqueId)
      .filter((id): id is number => id != null);

    const [polls, lineups, convocations] = await Promise.all([
      this.prisma.availabilityPoll.findMany({
        where: { matchUniqueId: { in: matchIds }, clubIndex },
        include: { responses: true },
      }),
      this.prisma.lineup.findMany({
        where: { matchUniqueId: { in: matchIds }, clubIndex },
      }),
      this.prisma.convocation.findMany({
        where: {
          matchUniqueId: { in: matchIds },
          lineup: { clubIndex },
        },
      }),
    ]);
    const pollByMatch = new Map(
      polls.map((p) => [p.matchUniqueId, p] as const),
    );
    const lineupByMatch = new Map(
      lineups.map((l) => [l.matchUniqueId, l] as const),
    );
    const convocationByMatch = new Set(
      convocations.map((c) => c.matchUniqueId),
    );

    const teamDtos: CaptainTeamDto[] = teams.map((team) => {
      const match = upcomingByDivision.get(team.DivisionId);
      const dto: CaptainTeamDto = {
        teamId: team.TeamId,
        teamLabel: team.Team,
        divisionId: team.DivisionId,
        divisionName: team.DivisionName ?? '',
        clubIndex,
      };
      if (match && match.MatchUniqueId != null) {
        const isHome = match.HomeClub === clubIndex;
        dto.nextMatch = {
          matchUniqueId: match.MatchUniqueId,
          opponent: isHome ? match.AwayTeam : match.HomeTeam,
          date: match.Date ?? '',
          time: match.Time ?? '',
          home: isHome,
          venue: match.VenueEntry?.Name,
          weekName: match.WeekName,
        };
        const poll = pollByMatch.get(match.MatchUniqueId);
        const lineup = lineupByMatch.get(match.MatchUniqueId);
        dto.prep = {
          availability: poll
            ? {
                present: poll.responses.filter(
                  (r) => r.status === AvailabilityStatus.PRESENT,
                ).length,
                absent: poll.responses.filter(
                  (r) => r.status === AvailabilityStatus.ABSENT,
                ).length,
                pending: poll.responses.filter(
                  (r) => r.status === AvailabilityStatus.PENDING,
                ).length,
                total: poll.responses.length,
              }
            : undefined,
          lineupStatus: lineup?.status ?? LineupStatus.A_FAIRE,
          convocationSent: convocationByMatch.has(match.MatchUniqueId),
        };
      }
      return dto;
    });

    return { teams: teamDtos };
  }

  private matchDate(match: TeamMatchesEntry): Date | null {
    if (!match.Date) {
      return null;
    }
    const time = match.Time && /^\d/.test(match.Time) ? match.Time : '00:00';
    const parsed = new Date(`${match.Date}T${time}`);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
}
