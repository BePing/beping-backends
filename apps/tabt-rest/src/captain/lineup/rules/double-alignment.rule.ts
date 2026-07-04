import { Rule } from './rule-set.interface';
import {
  LineupContext,
  RuleCode,
  RuleLevel,
  RuleViolation,
  starters,
} from './rule.types';

/**
 * C.20.1 — a player may not be aligned in two teams of the same category during
 * the same interclubs week (Mon–Sun); the lower team forfeits. Blocking error.
 *
 * Limitation: TabT does not reliably expose other clubs' provisional lineups, so
 * v1 evaluates only against OUR OWN starters for the same week (ctx.sameWeekLineups).
 * Alignments made by other clubs, or entered directly in TabT, are not detected here.
 */
export class DoubleAlignmentRule implements Rule {
  evaluate(ctx: LineupContext): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const myStarters = starters(ctx);
    for (const slot of myStarters) {
      const conflict = ctx.sameWeekLineups.find(
        (l) =>
          l.teamId !== ctx.team.teamId &&
          l.starterUniqueIndexes.includes(slot.uniqueIndex),
      );
      if (conflict) {
        const player = ctx.roster.get(slot.uniqueIndex);
        violations.push({
          code: RuleCode.DOUBLE_ALIGNMENT,
          level: RuleLevel.ERROR,
          messageKey: 'captain.rule.DOUBLE_ALIGNMENT',
          params: {
            uniqueIndex: String(slot.uniqueIndex),
            name: player ? `${player.firstName} ${player.lastName}` : '',
            otherTeamId: conflict.teamId,
            weekName: ctx.weekName ?? '',
          },
        });
      }
    }
    return violations;
  }
}
