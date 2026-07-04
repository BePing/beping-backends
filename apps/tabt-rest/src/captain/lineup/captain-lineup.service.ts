import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LineupStatus, SlotRole } from '@app/common';
import { PrismaService } from '@app/common';
import { CaptainRosterService } from '../captain-roster.service';
import { CaptainPrincipal } from '../auth/captain-jwt.guard';
import { RuleSetResolver } from './rules/rule-set.resolver';
import {
  LineupContext,
  LineupSlotCtx,
  RosterPlayer,
  RuleLevel,
  RuleViolation,
  SameWeekLineup,
  TeamContext,
} from './rules/rule.types';
import {
  LineupDto,
  LineupSlotDto,
  LineupValidationDto,
  RuleViolationDto,
  SaveLineupDto,
  ValidateLineupDto,
} from '../dto/lineup.dto';
import { TeamMatchesEntry } from '../../entity/tabt-soap/TabTAPI_Port';

interface StoredSlot {
  uniqueIndex: number;
  orderPos: number;
  role: SlotRole;
}

@Injectable()
export class CaptainLineupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roster: CaptainRosterService,
    private readonly ruleSetResolver: RuleSetResolver,
  ) {}

  // --- Public API ---------------------------------------------------------

  async getLineup(
    matchUniqueId: number,
    captain: CaptainPrincipal,
  ): Promise<LineupDto> {
    const match = await this.requireMatch(matchUniqueId);
    const team = await this.resolveTeamForMatch(captain.clubIndex, match);
    const roster = await this.roster.buildRoster(
      captain.clubIndex,
      team.category,
    );

    const lineup = await this.prisma.lineup.findUnique({
      where: { matchUniqueId },
      include: { slots: true },
    });
    const slots: StoredSlot[] =
      lineup?.slots.map((s) => ({
        uniqueIndex: s.uniqueIndex,
        orderPos: s.orderPos,
        role: s.role,
      })) ?? [];

    const validation = slots.length
      ? this.runValidation(
          await this.buildContext(
            captain.clubIndex,
            match,
            team,
            roster,
            slots,
          ),
          lineup?.status ?? LineupStatus.A_FAIRE,
        )
      : undefined;

    return {
      matchUniqueId,
      status: lineup?.status ?? LineupStatus.A_FAIRE,
      slots: slots.map((s) => this.toSlotDto(s, roster)),
      roster: await this.rosterEntries(matchUniqueId, roster),
      validation,
      opponentLastLineup: this.opponentLineup(match, captain.clubIndex),
    };
  }

  async saveLineup(
    matchUniqueId: number,
    captain: CaptainPrincipal,
    dto: SaveLineupDto,
  ): Promise<LineupDto> {
    const match = await this.requireMatch(matchUniqueId);
    const team = await this.resolveTeamForMatch(captain.clubIndex, match);

    await this.prisma.lineup.upsert({
      where: { matchUniqueId },
      create: {
        matchUniqueId,
        teamId: team.teamId,
        clubIndex: captain.clubIndex,
        status: LineupStatus.BROUILLON,
        createdBy: captain.uniqueIndex,
        slots: {
          create: dto.slots.map((s) => ({
            uniqueIndex: s.uniqueIndex,
            orderPos: s.orderPos,
            role: s.role,
          })),
        },
      },
      update: {
        teamId: team.teamId,
        status: LineupStatus.BROUILLON,
        slots: {
          deleteMany: {},
          create: dto.slots.map((s) => ({
            uniqueIndex: s.uniqueIndex,
            orderPos: s.orderPos,
            role: s.role,
          })),
        },
      },
    });

    return this.getLineup(matchUniqueId, captain);
  }

  async validateLineup(
    matchUniqueId: number,
    captain: CaptainPrincipal,
    dto: ValidateLineupDto,
  ): Promise<LineupValidationDto> {
    const lineup = await this.prisma.lineup.findUnique({
      where: { matchUniqueId },
      include: { slots: true },
    });
    if (!lineup) {
      throw new NotFoundException('No lineup to validate');
    }
    if (lineup.clubIndex !== captain.clubIndex) {
      throw new ForbiddenException('Not a captain of this club');
    }

    const match = await this.requireMatch(matchUniqueId);
    const team = await this.resolveTeamForMatch(captain.clubIndex, match);
    const roster = await this.roster.buildRoster(
      captain.clubIndex,
      team.category,
    );
    const slots: StoredSlot[] = lineup.slots.map((s) => ({
      uniqueIndex: s.uniqueIndex,
      orderPos: s.orderPos,
      role: s.role,
    }));
    const ctx = await this.buildContext(
      captain.clubIndex,
      match,
      team,
      roster,
      slots,
    );
    const ruleSet = this.ruleSetResolver.resolve(team);
    const violations = ruleSet.evaluate(ctx);
    const errors = violations.filter((v) => v.level === RuleLevel.ERROR);
    const warnings = violations.filter((v) => v.level === RuleLevel.WARNING);

    const validation: LineupValidationDto = {
      status: lineup.status,
      errors: errors.map(this.toViolationDto),
      warnings: warnings.map(this.toViolationDto),
      canOverride: errors.length === 0,
      provinceUnsupported: ruleSet.provinceUnsupported,
    };

    // Blocking errors can never be validated.
    if (errors.length > 0) {
      await this.persistValidation(matchUniqueId, LineupStatus.BROUILLON, {
        errors,
        warnings,
      });
      validation.status = LineupStatus.BROUILLON;
      throw new UnprocessableEntityException(validation);
    }

    // Warnings block validation unless explicitly overridden with a justification.
    if (warnings.length > 0 && !dto.overrideWarnings) {
      await this.persistValidation(matchUniqueId, LineupStatus.BROUILLON, {
        errors,
        warnings,
      });
      validation.status = LineupStatus.BROUILLON;
      return validation;
    }
    if (warnings.length > 0 && dto.overrideWarnings && !dto.justification) {
      throw new BadRequestException(
        'A justification is required to override warnings',
      );
    }

    const forceSnapshot = this.snapshot(slots, roster);
    await this.prisma.lineup.update({
      where: { matchUniqueId },
      data: {
        status: LineupStatus.VALIDEE,
        validation: { errors, warnings } as any,
        forceSnapshot: forceSnapshot as any,
        overrideJustification: dto.justification,
        validatedAt: new Date(),
      },
    });
    validation.status = LineupStatus.VALIDEE;
    return validation;
  }

  // --- Internals ----------------------------------------------------------

  private runValidation(
    ctx: LineupContext,
    status: LineupStatus,
  ): LineupValidationDto {
    const ruleSet = this.ruleSetResolver.resolve(ctx.team);
    const violations = ruleSet.evaluate(ctx);
    const errors = violations.filter((v) => v.level === RuleLevel.ERROR);
    const warnings = violations.filter((v) => v.level === RuleLevel.WARNING);
    return {
      status,
      errors: errors.map(this.toViolationDto),
      warnings: warnings.map(this.toViolationDto),
      canOverride: errors.length === 0,
      provinceUnsupported: ruleSet.provinceUnsupported,
    };
  }

  private async persistValidation(
    matchUniqueId: number,
    status: LineupStatus,
    payload: { errors: RuleViolation[]; warnings: RuleViolation[] },
  ): Promise<void> {
    await this.prisma.lineup.update({
      where: { matchUniqueId },
      data: { status, validation: payload as any },
    });
  }

  private async requireMatch(matchUniqueId: number): Promise<TeamMatchesEntry> {
    const match = await this.roster.getMatch(matchUniqueId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }

  /** Resolves the captain's team for a match by matching the club's division. */
  private async resolveTeamForMatch(
    clubIndex: string,
    match: TeamMatchesEntry,
  ): Promise<TeamContext> {
    const isHome = match.HomeClub === clubIndex;
    const isAway = match.AwayClub === clubIndex;
    if (!isHome && !isAway) {
      throw new ForbiddenException('This match does not involve your club');
    }
    const teams = await this.roster.getClubTeams(clubIndex);
    const team = teams.find((t) => t.DivisionId === match.DivisionId);
    if (!team) {
      throw new NotFoundException('Team not found for this match division');
    }
    const ctx = await this.roster.resolveTeamContext(clubIndex, team.TeamId);
    if (!ctx) {
      throw new NotFoundException('Unable to resolve team context');
    }
    return ctx;
  }

  private async buildContext(
    clubIndex: string,
    match: TeamMatchesEntry,
    team: TeamContext,
    roster: Map<number, RosterPlayer>,
    slots: StoredSlot[],
  ): Promise<LineupContext> {
    const slotCtx: LineupSlotCtx[] = slots.map((s) => ({
      uniqueIndex: s.uniqueIndex,
      orderPos: s.orderPos,
      role: s.role,
    }));

    const { sameWeekLineups, higherTeamStarters } = await this.sameWeekContext(
      clubIndex,
      team,
      match,
      roster,
    );

    return {
      team,
      slots: slotCtx,
      roster,
      sameWeekLineups,
      higherTeamStarters,
      weekName: match.WeekName,
    };
  }

  /**
   * Builds the double-alignment and higher-team context from OUR OWN lineups for
   * the same interclubs week (matched by TabT WeekName within the same category).
   */
  private async sameWeekContext(
    clubIndex: string,
    team: TeamContext,
    match: TeamMatchesEntry,
    roster: Map<number, RosterPlayer>,
  ): Promise<{
    sameWeekLineups: SameWeekLineup[];
    higherTeamStarters?: RosterPlayer[];
  }> {
    const [weekByMatch, teamMeta, siblings] = await Promise.all([
      this.roster.clubMatchWeeks(clubIndex),
      this.roster.teamMeta(clubIndex),
      this.prisma.lineup.findMany({
        where: {
          clubIndex,
          matchUniqueId: { not: match.MatchUniqueId },
          status: { in: [LineupStatus.BROUILLON, LineupStatus.VALIDEE] },
        },
        include: { slots: true },
      }),
    ]);

    const sameWeekLineups: SameWeekLineup[] = [];
    let higherTeamStarters: RosterPlayer[] | undefined;

    for (const sib of siblings) {
      const weekName = weekByMatch.get(sib.matchUniqueId);
      if (!weekName || weekName !== match.WeekName) {
        continue;
      }
      const meta = teamMeta.get(sib.teamId);
      if (!meta || meta.category !== team.category) {
        continue;
      }
      const starterIndexes = sib.slots
        .filter((s) => s.role === SlotRole.TITULAIRE && s.orderPos <= 100)
        .map((s) => s.uniqueIndex);
      sameWeekLineups.push({
        teamId: sib.teamId,
        teamRankInClub: meta.teamRankInClub,
        starterUniqueIndexes: starterIndexes,
      });
      if (
        meta.teamRankInClub === team.teamRankInClub - 1 &&
        sib.status === LineupStatus.VALIDEE
      ) {
        higherTeamStarters = starterIndexes
          .map((i) => roster.get(i))
          .filter((p): p is RosterPlayer => !!p);
      }
    }

    return { sameWeekLineups, higherTeamStarters };
  }

  private snapshot(
    slots: StoredSlot[],
    roster: Map<number, RosterPlayer>,
  ): Array<{
    uniqueIndex: number;
    orderPos: number;
    role: SlotRole;
    rankingIndex: number | null;
    position: number | null;
    ranking: string | null;
  }> {
    return slots.map((s) => {
      const p = roster.get(s.uniqueIndex);
      return {
        uniqueIndex: s.uniqueIndex,
        orderPos: s.orderPos,
        role: s.role,
        rankingIndex: p?.rankingIndex ?? null,
        position: p?.position ?? null,
        ranking: p?.ranking ?? null,
      };
    });
  }

  private toSlotDto(
    slot: StoredSlot,
    roster: Map<number, RosterPlayer>,
  ): LineupSlotDto {
    const p = roster.get(slot.uniqueIndex);
    return {
      uniqueIndex: slot.uniqueIndex,
      orderPos: slot.orderPos,
      role: slot.role,
      firstName: p?.firstName,
      lastName: p?.lastName,
      ranking: p?.ranking,
      rankingIndex: p?.rankingIndex,
    };
  }

  /** Roster enriched with availability responses (present players first). */
  private async rosterEntries(
    matchUniqueId: number,
    roster: Map<number, RosterPlayer>,
  ) {
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: { matchUniqueId },
      include: { responses: true },
    });
    const responseByIndex = new Map(
      (poll?.responses ?? []).map((r) => [r.uniqueIndex, r] as const),
    );
    return Array.from(roster.values()).map((p) => {
      const r = responseByIndex.get(p.uniqueIndex);
      return {
        uniqueIndex: p.uniqueIndex,
        firstName: p.firstName,
        lastName: p.lastName,
        ranking: p.ranking,
        rankingIndex: p.rankingIndex,
        status: (r?.status ?? 'PENDING') as any,
        note: r?.note ?? undefined,
        respondedAt: r?.respondedAt?.toISOString(),
        source: (r?.source ?? 'PLAYER') as any,
      };
    });
  }

  private opponentLineup(match: TeamMatchesEntry, clubIndex: string) {
    const isHome = match.HomeClub === clubIndex;
    const opponentPlayers = isHome
      ? match.MatchDetails?.AwayPlayers?.Players
      : match.MatchDetails?.HomePlayers?.Players;
    if (!opponentPlayers?.length) {
      return undefined;
    }
    return opponentPlayers.map((p) => ({
      position: p.Position,
      name: `${p.FirstName} ${p.LastName}`,
      ranking: p.Ranking,
    }));
  }

  private toViolationDto(v: RuleViolation): RuleViolationDto {
    return {
      code: v.code,
      level: v.level,
      messageKey: v.messageKey,
      params: v.params,
    };
  }
}
