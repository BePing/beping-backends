import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SlotRole } from '@app/common';
import { PrismaService } from '@app/common';
import { CaptainRosterService } from '../captain-roster.service';
import { CaptainPrincipal } from '../auth/captain-jwt.guard';
import { RuleSetResolver } from '../lineup/rules/rule-set.resolver';
import {
  continuousPlace,
  LineupContext,
  RosterPlayer,
  RuleLevel,
  TeamContext,
} from '../lineup/rules/rule.types';
import {
  FaceToFaceDto,
  LineupIntelligenceDto,
  ReinforcementDto,
} from '../dto/intelligence.dto';
import { LineupSlotInputDto } from '../dto/lineup.dto';
import { duelProbability, teamWinProbability } from './win-probability';
import { TeamMatchesEntry } from '../../entity/tabt-soap/TabTAPI_Port';

@Injectable()
export class CaptainIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roster: CaptainRosterService,
    private readonly ruleSetResolver: RuleSetResolver,
  ) {}

  async getIntelligence(
    matchUniqueId: number,
    captain: CaptainPrincipal,
  ): Promise<LineupIntelligenceDto> {
    const lineup = await this.prisma.lineup.findUnique({
      where: { matchUniqueId },
      include: { slots: true },
    });
    if (!lineup) {
      throw new NotFoundException(
        'Save a lineup before requesting intelligence',
      );
    }
    if (lineup.clubIndex !== captain.clubIndex) {
      throw new ForbiddenException('Not a captain of this club');
    }

    const match = await this.roster.getMatch(matchUniqueId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    const team = await this.requireTeam(captain.clubIndex, match);
    const roster = await this.roster.buildRoster(
      captain.clubIndex,
      team.category,
    );

    const starterIndexes = lineup.slots
      .filter((s) => s.role === SlotRole.TITULAIRE && s.orderPos <= 100)
      .sort((a, b) => a.orderPos - b.orderPos)
      .map((s) => s.uniqueIndex);
    const starters = starterIndexes
      .map((i) => roster.get(i))
      .filter((p): p is RosterPlayer => !!p);

    // Predicted opponent lineup: opponent club's strongest N of the category.
    const opponentClub =
      match.HomeClub === captain.clubIndex ? match.AwayClub : match.HomeClub;
    const opponentRoster = await this.roster.buildRoster(
      opponentClub,
      team.category,
    );
    const opponents = Array.from(opponentRoster.values())
      .sort((a, b) => a.rankingIndex - b.rankingIndex)
      .slice(0, team.teamSize);

    const points = await this.loadPoints([
      ...starters.map((p) => p.uniqueIndex),
      ...opponents.map((p) => p.uniqueIndex),
      ...Array.from(roster.values()).map((p) => p.uniqueIndex),
    ]);
    const pts = (p: RosterPlayer) => this.pointsOf(p, points);

    const winProbability = teamWinProbability(
      starters.map(pts),
      opponents.map(pts),
    );

    // Optimal positional order among rule-compliant permutations, maximising the
    // summed position-by-position face-to-face edge.
    const { order, expected } = this.optimalOrder(
      starters,
      opponents,
      team,
      roster,
      pts,
    );
    const currentExpected = this.positionalExpected(starters, opponents, pts);
    const probabilityDelta =
      starters.length > 0 ? (expected - currentExpected) / starters.length : 0;

    const faceToFace = this.faceToFace(order, opponents, pts);
    const reinforcements = await this.reinforcements(
      captain.clubIndex,
      team,
      starters,
      opponents,
      roster,
      points,
      winProbability,
    );

    return {
      winProbability,
      probabilityDelta,
      optimalOrder: order.map((p, i): LineupSlotInputDto => ({
        uniqueIndex: p.uniqueIndex,
        orderPos: i + 1,
        role: SlotRole.TITULAIRE,
      })),
      faceToFace,
      reinforcements,
    };
  }

  private async requireTeam(
    clubIndex: string,
    match: TeamMatchesEntry,
  ): Promise<TeamContext> {
    const teams = await this.roster.getClubTeams(clubIndex);
    const team = teams.find((t) => t.DivisionId === match.DivisionId);
    if (!team) {
      throw new NotFoundException('Team not found for this match');
    }
    const ctx = await this.roster.resolveTeamContext(clubIndex, team.TeamId);
    if (!ctx) {
      throw new NotFoundException('Unable to resolve team context');
    }
    return ctx;
  }

  /** Latest numeric points per member from the imported dataset, if present. */
  private async loadPoints(indexes: number[]): Promise<Map<number, number>> {
    const unique = Array.from(new Set(indexes));
    const rows = await this.prisma.numericPoints.findMany({
      where: { memberId: { in: unique } },
      orderBy: { date: 'desc' },
    });
    const map = new Map<number, number>();
    for (const row of rows) {
      if (!map.has(row.memberId)) {
        map.set(row.memberId, row.points);
      }
    }
    return map;
  }

  /**
   * Points for a player: real numeric points when available, otherwise a
   * monotone pseudo-points fallback derived from the reference index (lower
   * index = stronger). TODO: always source real points once import coverage is
   * guaranteed.
   */
  private pointsOf(p: RosterPlayer, points: Map<number, number>): number {
    const real = points.get(p.uniqueIndex);
    if (real != null) {
      return real;
    }
    return 2000 - (p.rankingIndex ?? 0) * 40;
  }

  private positionalExpected(
    mine: RosterPlayer[],
    theirs: RosterPlayer[],
    pts: (p: RosterPlayer) => number,
  ): number {
    let sum = 0;
    for (let i = 0; i < mine.length; i++) {
      const opp = theirs[i];
      if (!opp) {
        continue;
      }
      sum += duelProbability(pts(mine[i]), pts(opp));
    }
    return sum;
  }

  private optimalOrder(
    starters: RosterPlayer[],
    opponents: RosterPlayer[],
    team: TeamContext,
    roster: Map<number, RosterPlayer>,
    pts: (p: RosterPlayer) => number,
  ): { order: RosterPlayer[]; expected: number } {
    const ruleSet = this.ruleSetResolver.resolve(team);
    let best: RosterPlayer[] = starters;
    let bestScore = -1;
    for (const perm of permutations(starters)) {
      const ctx = this.contextFor(perm, team, roster);
      const hasError = ruleSet
        .evaluate(ctx)
        .some((v) => v.level === RuleLevel.ERROR);
      if (hasError) {
        continue;
      }
      const score = this.positionalExpected(perm, opponents, pts);
      if (score > bestScore) {
        bestScore = score;
        best = perm;
      }
    }
    if (bestScore < 0) {
      // No rule-compliant order; fall back to the given order.
      return {
        order: starters,
        expected: this.positionalExpected(starters, opponents, pts),
      };
    }
    return { order: best, expected: bestScore };
  }

  private contextFor(
    order: RosterPlayer[],
    team: TeamContext,
    roster: Map<number, RosterPlayer>,
  ): LineupContext {
    return {
      team,
      slots: order.map((p, i) => ({
        uniqueIndex: p.uniqueIndex,
        orderPos: i + 1,
        role: SlotRole.TITULAIRE,
      })),
      roster,
      sameWeekLineups: [],
    };
  }

  private faceToFace(
    mine: RosterPlayer[],
    theirs: RosterPlayer[],
    pts: (p: RosterPlayer) => number,
  ): FaceToFaceDto[] {
    return mine.map((p, i) => {
      const opp = theirs[i];
      const prob = opp ? duelProbability(pts(p), pts(opp)) : 0.5;
      const edge = prob >= 0.6 ? 'ADVANTAGE' : prob <= 0.4 ? 'TRAP' : 'TIGHT';
      return {
        position: i + 1,
        mine: {
          uniqueIndex: p.uniqueIndex,
          name: `${p.firstName} ${p.lastName}`,
          ranking: p.ranking,
        },
        theirs: {
          name: opp ? `${opp.firstName} ${opp.lastName}` : '—',
          ranking: opp?.ranking ?? '',
        },
        edge,
        winProbability: prob,
      };
    });
  }

  /**
   * Reinforcements: players from weaker teams of the same club (higher team rank)
   * who may play up (their reference index allows this team's places) and are not
   * already aligned the same week.
   */
  private async reinforcements(
    clubIndex: string,
    team: TeamContext,
    starters: RosterPlayer[],
    opponents: RosterPlayer[],
    roster: Map<number, RosterPlayer>,
    points: Map<number, number>,
    baseWinProbability: number,
  ): Promise<ReinforcementDto[]> {
    const pts = (p: RosterPlayer) => this.pointsOf(p, points);
    const starterSet = new Set(starters.map((p) => p.uniqueIndex));
    const teams = await this.roster.getClubTeams(clubIndex);
    const teamMeta = await this.roster.teamMeta(clubIndex);

    // The lowest starter place of this team defines the "playing-up" threshold.
    const lowestPlace = continuousPlace(
      team.teamRankInClub,
      team.teamSize,
      team.teamSize,
    );

    // Weakest current starter (highest points opponent gain reference).
    const weakest = [...starters].sort((a, b) => pts(a) - pts(b))[0];

    const candidates: ReinforcementDto[] = [];
    for (const player of roster.values()) {
      if (starterSet.has(player.uniqueIndex)) {
        continue;
      }
      // Eligible only if the reference index allows playing at this team's places.
      const eligible = player.rankingIndex >= lowestPlace;
      // Identify the player's own (weaker) team for display, if any.
      const fromTeam =
        teams.find((t) => teamMeta.get(t.TeamId)?.category === team.category)
          ?.Team ?? '';

      let probabilityGain = 0;
      if (weakest) {
        const swapped = starters.map((p) =>
          p.uniqueIndex === weakest.uniqueIndex ? player : p,
        );
        probabilityGain =
          teamWinProbability(swapped.map(pts), opponents.map(pts)) -
          baseWinProbability;
      }

      candidates.push({
        uniqueIndex: player.uniqueIndex,
        name: `${player.firstName} ${player.lastName}`,
        ranking: player.ranking,
        rankingIndex: player.rankingIndex,
        fromTeam,
        probabilityGain,
        eligible,
        blockedBy: eligible ? undefined : 'RANKING_INDEX',
      });
    }

    return candidates
      .filter((c) => c.probabilityGain > 0)
      .sort((a, b) => b.probabilityGain - a.probabilityGain)
      .slice(0, 5);
  }
}

/** All permutations of a small array (used for the 4-starter brute force). */
function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) {
    return [arr];
  }
  const result: T[][] = [];
  arr.forEach((item, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([item, ...perm]);
    }
  });
  return result;
}
