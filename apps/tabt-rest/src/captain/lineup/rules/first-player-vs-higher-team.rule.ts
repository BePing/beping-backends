import { Rule } from './rule-set.interface';
import {
  LineupCategory,
  LineupContext,
  RuleCode,
  RuleLevel,
  RuleViolation,
  starters,
} from './rule.types';

/**
 * C.22.1.3 / C.22.2.3 — the first player of a team may not be stronger than the
 * 3rd effective player of the immediately-higher team (2nd for women). This is a
 * predictive check against our own validated higher-team lineup for the same
 * week, so it is a warning, not a blocking error.
 *
 * Limitation: "effective" means "actually played"; before the match we only have
 * the intended starters of the higher team, so this compares against those.
 */
export class FirstPlayerVsHigherTeamRule implements Rule {
  evaluate(ctx: LineupContext): RuleViolation[] {
    const higher = ctx.higherTeamStarters;
    if (!higher || higher.length === 0) {
      return [];
    }
    const myStarters = starters(ctx);
    if (myStarters.length === 0) {
      return [];
    }
    const myFirst = ctx.roster.get(myStarters[0].uniqueIndex);
    if (!myFirst) {
      return [];
    }

    // Reference = Nth strongest starter of the higher team (3rd men, 2nd women).
    const referenceRank = ctx.team.category === LineupCategory.WOMEN ? 2 : 3;
    const sortedHigher = [...higher].sort(
      (a, b) => a.rankingIndex - b.rankingIndex,
    );
    const reference =
      sortedHigher[Math.min(referenceRank, sortedHigher.length) - 1];
    if (!reference) {
      return [];
    }

    // Stronger = strictly lower rankingIndex.
    if (myFirst.rankingIndex < reference.rankingIndex) {
      return [
        {
          code: RuleCode.FIRST_PLAYER_VS_HIGHER_TEAM,
          level: RuleLevel.WARNING,
          messageKey: 'captain.rule.FIRST_PLAYER_VS_HIGHER_TEAM',
          params: {
            firstName: `${myFirst.firstName} ${myFirst.lastName}`,
            firstIndex: String(myFirst.rankingIndex),
            referenceName: `${reference.firstName} ${reference.lastName}`,
            referenceIndex: String(reference.rankingIndex),
            referenceRank: String(referenceRank),
          },
        },
      ];
    }
    return [];
  }
}
