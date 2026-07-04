import { Rule } from './rule-set.interface';
import {
  continuousPlace,
  LineupContext,
  RuleCode,
  RuleLevel,
  RuleViolation,
  starters,
} from './rule.types';

/**
 * C.22.1.1 — a player may not be aligned at a place lower (higher number) than
 * his "indice de référence" allows. `rankingIndex` is the lowest place number
 * at which the player may play; aligning him at a continuous place beyond that
 * index is a forfait (max score against). Blocking error.
 */
export class PlayerBelowPlaceRule implements Rule {
  evaluate(ctx: LineupContext): RuleViolation[] {
    const violations: RuleViolation[] = [];
    for (const slot of starters(ctx)) {
      const player = ctx.roster.get(slot.uniqueIndex);
      if (!player || player.rankingIndex == null) {
        continue;
      }
      const place = continuousPlace(
        ctx.team.teamRankInClub,
        ctx.team.teamSize,
        slot.orderPos,
      );
      if (place > player.rankingIndex) {
        violations.push({
          code: RuleCode.PLAYER_BELOW_PLACE,
          level: RuleLevel.ERROR,
          messageKey: 'captain.rule.PLAYER_BELOW_PLACE',
          params: {
            uniqueIndex: String(player.uniqueIndex),
            name: `${player.firstName} ${player.lastName}`,
            place: String(place),
            rankingIndex: String(player.rankingIndex),
          },
        });
      }
    }
    return violations;
  }
}
