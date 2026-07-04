import { Rule } from './rule-set.interface';
import {
  LineupContext,
  RuleCode,
  RuleLevel,
  RuleViolation,
  starters,
} from './rule.types';

/**
 * C.22.3.1 — starters must be listed in non-increasing order of strength, i.e.
 * `rankingIndex` non-decreasing along orderPos 1..N. Equal indices may be
 * ordered freely. A wrong order is a fine, not a forfait → warning (overridable).
 */
export class OrderOfForceRule implements Rule {
  evaluate(ctx: LineupContext): RuleViolation[] {
    const ordered = starters(ctx);
    const violations: RuleViolation[] = [];
    for (let i = 1; i < ordered.length; i++) {
      const prev = ctx.roster.get(ordered[i - 1].uniqueIndex);
      const curr = ctx.roster.get(ordered[i].uniqueIndex);
      if (!prev || !curr) {
        continue;
      }
      if (prev.rankingIndex > curr.rankingIndex) {
        violations.push({
          code: RuleCode.ORDER_OF_FORCE,
          level: RuleLevel.WARNING,
          messageKey: 'captain.rule.ORDER_OF_FORCE',
          params: {
            position: String(ordered[i].orderPos),
            strongerName: `${curr.firstName} ${curr.lastName}`,
            strongerIndex: String(curr.rankingIndex),
            weakerName: `${prev.firstName} ${prev.lastName}`,
            weakerIndex: String(prev.rankingIndex),
          },
        });
      }
    }
    return violations;
  }
}
