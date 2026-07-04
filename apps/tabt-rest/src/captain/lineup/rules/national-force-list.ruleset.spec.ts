import { SlotRole } from '@app/common';
import { NationalForceListRuleSet } from './national-force-list.ruleset';
import { TeamSizeRule } from './team-size.rule';
import { PlayerBelowPlaceRule } from './player-below-place.rule';
import { OrderOfForceRule } from './order-of-force.rule';
import { DoubleAlignmentRule } from './double-alignment.rule';
import {
  LineupCategory,
  LineupContext,
  LineupSlotCtx,
  RosterPlayer,
  RuleCode,
  RuleLevel,
  SameWeekLineup,
  TeamContext,
} from './rule.types';

function player(
  uniqueIndex: number,
  rankingIndex: number,
  overrides: Partial<RosterPlayer> = {},
): RosterPlayer {
  return {
    uniqueIndex,
    firstName: `P${uniqueIndex}`,
    lastName: 'X',
    ranking: 'C0',
    rankingIndex,
    position: rankingIndex,
    gender: 'M',
    ...overrides,
  };
}

function starterSlots(indexes: number[]): LineupSlotCtx[] {
  return indexes.map((uniqueIndex, i) => ({
    uniqueIndex,
    orderPos: i + 1,
    role: SlotRole.TITULAIRE,
  }));
}

function team(overrides: Partial<TeamContext> = {}): TeamContext {
  return {
    teamId: 'T-A',
    teamLetter: 'A',
    teamRankInClub: 1,
    teamSize: 4,
    category: LineupCategory.MEN,
    divisionId: 100,
    ...overrides,
  };
}

function context(
  players: RosterPlayer[],
  slots: LineupSlotCtx[],
  overrides: Partial<LineupContext> = {},
): LineupContext {
  return {
    team: team(overrides.team),
    slots,
    roster: new Map(players.map((p) => [p.uniqueIndex, p] as const)),
    sameWeekLineups: [],
    weekName: 'week-1',
    ...overrides,
  };
}

describe('NationalForceListRuleSet', () => {
  const ruleSet = new NationalForceListRuleSet();

  describe('TEAM_SIZE (C.4.1)', () => {
    it('flags a men team with 3 starters as ERROR', () => {
      const players = [10, 20, 30].map((i) => player(i, i));
      const ctx = context(players, starterSlots([10, 20, 30]));
      const violations = new TeamSizeRule().evaluate(ctx);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe(RuleCode.TEAM_SIZE);
      expect(violations[0].level).toBe(RuleLevel.ERROR);
    });

    it('accepts a women team with 3 starters', () => {
      const players = [10, 20, 30].map((i) => player(i, i, { gender: 'F' }));
      const ctx = context(players, starterSlots([10, 20, 30]), {
        team: team({ category: LineupCategory.WOMEN, teamSize: 3 }),
      });
      expect(new TeamSizeRule().evaluate(ctx)).toHaveLength(0);
    });
  });

  describe('PLAYER_BELOW_PLACE (C.22.1.1)', () => {
    it('flags a player aligned below his reference index as ERROR', () => {
      // Team A place 4 requires rankingIndex >= 4; player has index 3.
      const players = [player(1, 1), player(2, 2), player(3, 3), player(4, 3)];
      const ctx = context(players, starterSlots([1, 2, 3, 4]));
      const violations = new PlayerBelowPlaceRule().evaluate(ctx);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe(RuleCode.PLAYER_BELOW_PLACE);
      expect(violations[0].level).toBe(RuleLevel.ERROR);
      expect(violations[0].params.uniqueIndex).toBe('4');
    });

    it('accepts players whose reference index covers their place', () => {
      const players = [player(1, 1), player(2, 2), player(3, 3), player(4, 10)];
      const ctx = context(players, starterSlots([1, 2, 3, 4]));
      expect(new PlayerBelowPlaceRule().evaluate(ctx)).toHaveLength(0);
    });
  });

  describe('ORDER_OF_FORCE (C.22.3.1)', () => {
    it('warns on an order inversion', () => {
      const players = [player(1, 5), player(2, 3), player(3, 6), player(4, 7)];
      const ctx = context(players, starterSlots([1, 2, 3, 4]));
      const violations = new OrderOfForceRule().evaluate(ctx);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe(RuleCode.ORDER_OF_FORCE);
      expect(violations[0].level).toBe(RuleLevel.WARNING);
    });

    it('accepts equal reference indices in any order', () => {
      const players = [player(1, 5), player(2, 5), player(3, 5), player(4, 5)];
      const ctx = context(players, starterSlots([1, 2, 3, 4]));
      expect(new OrderOfForceRule().evaluate(ctx)).toHaveLength(0);
    });
  });

  describe('DOUBLE_ALIGNMENT (C.20.1)', () => {
    it('flags a player also aligned in another team the same week as ERROR', () => {
      const players = [player(1, 1), player(2, 2), player(3, 3), player(4, 4)];
      const sameWeek: SameWeekLineup[] = [
        { teamId: 'T-B', teamRankInClub: 2, starterUniqueIndexes: [1, 99] },
      ];
      const ctx = context(players, starterSlots([1, 2, 3, 4]), {
        sameWeekLineups: sameWeek,
      });
      const violations = new DoubleAlignmentRule().evaluate(ctx);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe(RuleCode.DOUBLE_ALIGNMENT);
      expect(violations[0].level).toBe(RuleLevel.ERROR);
    });

    it('does not flag when there is no same-week overlap (different week)', () => {
      const players = [player(1, 1), player(2, 2), player(3, 3), player(4, 4)];
      const ctx = context(players, starterSlots([1, 2, 3, 4]), {
        sameWeekLineups: [],
      });
      expect(new DoubleAlignmentRule().evaluate(ctx)).toHaveLength(0);
    });
  });

  describe('full rule set', () => {
    it('returns no violation for a clean, ordered team', () => {
      const players = [player(1, 1), player(2, 2), player(3, 3), player(4, 4)];
      const ctx = context(players, starterSlots([1, 2, 3, 4]));
      expect(ruleSet.evaluate(ctx)).toHaveLength(0);
    });

    it('aggregates errors and warnings together', () => {
      // Player 4 below place (error) + inversion at pos 1/2 (warning).
      const players = [player(1, 5), player(2, 3), player(3, 3), player(4, 3)];
      const ctx = context(players, starterSlots([1, 2, 3, 4]));
      const violations = ruleSet.evaluate(ctx);
      const codes = violations.map((v) => v.code);
      expect(codes).toContain(RuleCode.PLAYER_BELOW_PLACE);
      expect(codes).toContain(RuleCode.ORDER_OF_FORCE);
    });
  });
});
