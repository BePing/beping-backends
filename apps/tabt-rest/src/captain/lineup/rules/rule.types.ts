import { SlotRole } from '@app/common';

/**
 * Federal rule codes for interclubs lineup validation (AFTT Règlements
 * Sportifs Nationaux, 01/07/2025). ERROR-level codes block validation;
 * WARNING-level codes are overridable with a justification.
 */
export enum RuleCode {
  TEAM_SIZE = 'TEAM_SIZE',
  PLAYER_BELOW_PLACE = 'PLAYER_BELOW_PLACE',
  DOUBLE_ALIGNMENT = 'DOUBLE_ALIGNMENT',
  MAX_DOUBLE_AFFILIATION = 'MAX_DOUBLE_AFFILIATION',
  ORDER_OF_FORCE = 'ORDER_OF_FORCE',
  FIRST_PLAYER_VS_HIGHER_TEAM = 'FIRST_PLAYER_VS_HIGHER_TEAM',
}

export enum RuleLevel {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
}

export enum LineupCategory {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  VETERANS = 'VETERANS',
}

export interface RuleViolation {
  code: RuleCode;
  level: RuleLevel;
  /** i18n key resolved client-side, e.g. `captain.rule.PLAYER_BELOW_PLACE`. */
  messageKey: string;
  /** Interpolation params for the message (all stringified). */
  params: Record<string, string>;
}

/**
 * A player of the club force list, derived live from TabT.
 * `rankingIndex` = "indice de référence" (C.21): the lowest place number at
 * which the player may be aligned (lower number = stronger). `position` = the
 * player's unique rank within the whole club force list.
 */
export interface RosterPlayer {
  uniqueIndex: number;
  firstName: string;
  lastName: string;
  ranking: string;
  rankingIndex: number;
  position: number;
  gender?: 'M' | 'F';
  /** True when the member plays under a double affiliation (C.18.7.3). */
  doubleAffiliated?: boolean;
}

export interface LineupSlotCtx {
  uniqueIndex: number;
  /** 1..4 (or 1..3 women/vet) for starters, >100 for bench. */
  orderPos: number;
  role: SlotRole;
}

export interface TeamContext {
  teamId: string;
  /** Team letter A, B, C… as published by TabT. */
  teamLetter: string;
  /** 1-based rank of the team inside its club (A=1, B=2…). */
  teamRankInClub: number;
  /** Number of starters required (4 men, 3 women/veterans). */
  teamSize: number;
  category: LineupCategory;
  divisionId: number;
}

/**
 * Another lineup of the same club for the same interclubs week (Mon–Sun),
 * used to detect double alignments against our own data.
 */
export interface SameWeekLineup {
  teamId: string;
  teamRankInClub: number;
  starterUniqueIndexes: number[];
}

export interface LineupContext {
  team: TeamContext;
  slots: LineupSlotCtx[];
  /** Whole club force list keyed by uniqueIndex. */
  roster: Map<number, RosterPlayer>;
  /** Our own starters for other teams the same week (double-alignment source). */
  sameWeekLineups: SameWeekLineup[];
  /**
   * Validated lineup of the immediately-higher team the same week, if any
   * (source for the predictive FIRST_PLAYER_VS_HIGHER_TEAM warning).
   */
  higherTeamStarters?: RosterPlayer[];
  weekName?: string;
}

/** Continuous federal place number of a starter across the club's teams. */
export function continuousPlace(
  teamRankInClub: number,
  teamSize: number,
  orderPos: number,
): number {
  return (teamRankInClub - 1) * teamSize + orderPos;
}

/** Starters only (bench uses orderPos > 100), sorted by ascending orderPos. */
export function starters(ctx: LineupContext): LineupSlotCtx[] {
  return ctx.slots
    .filter((s) => s.role === SlotRole.TITULAIRE && s.orderPos <= 100)
    .sort((a, b) => a.orderPos - b.orderPos);
}
